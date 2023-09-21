const express = require("express");
const axios = require("axios");
const readline = require("readline");
const fs = require("fs");

const app = express();

const PORT = 3000;
const CLIENT_ID = "YOUR_CLIENT_ID_HERE";
const CLIENT_SECRET = "YOUR_CLIENT_SECRET_HERE";

const REDIRECT_URI = "http://localhost:3000/callback";
const TRAKT_API_BASE = "https://api.trakt.tv";

let accessToken = null;
let successCount = 0;
let notFoundCount = 0;

const traktHeaders = () => ({
  "Content-Type": "application/json",
  "trakt-api-version": "2",
  "trakt-api-key": CLIENT_ID,
  Authorization: `Bearer ${accessToken}`,
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chineseToNumber(chineseNum) {
  const numbers = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

  if (chineseNum.length === 1) {
    return numbers[chineseNum];
  } else if (chineseNum === "十") {
    return 10;
  } else if (chineseNum.startsWith("十")) {
    return 10 + numbers[chineseNum[1]];
  } else {
    return numbers[chineseNum[0]] * 10 + (numbers[chineseNum[1]] || 0);
  }
}

function readDoubanWatchedHistory(filePath = "douban_watched_history.txt") {
  return new Promise((resolve, reject) => {
    const readInterface = readline.createInterface({
      input: fs.createReadStream(filePath),
      output: process.stdout,
      console: false,
    });

    let moviesAndShows = [];

    readInterface.on("line", function (line) {
      const regex =
        /https:\/\/movie\.douban\.com\/subject\/\d+\/ \| (.+?) \| (\d{4}-\d{2}-\d{2})/;
      const match = line.match(regex);

      if (match) {
        let combinedTitle = match[1];
        let watchedDate = match[2];
        let title, alias;

        if (combinedTitle.includes(" / ")) {
          [title, alias] = combinedTitle.split(" / ");
        } else {
          title = combinedTitle;
          alias = null;
        }

        let isShow = false;
        let seasonNumber = null;

        const chineseSeasonRegex = /第(一|二|三|四|五|六|七|八|九|十)+季/;
        const englishSeasonRegex = /Season (\d+)/;
        let seasonMatch = title.match(chineseSeasonRegex);
        let isChinese = true;

        if (!seasonMatch && alias) {
          seasonMatch = alias.match(chineseSeasonRegex);
        }

        if (!seasonMatch) {
          seasonMatch = title.match(englishSeasonRegex);
          isChinese = false;
        }

        if (!seasonMatch && alias) {
          seasonMatch = alias.match(englishSeasonRegex);
        }

        if (seasonMatch) {
          isShow = true;
          seasonNumber = isChinese
            ? chineseToNumber(seasonMatch[1])
            : parseInt(seasonMatch[1], 10);

          // Remove season information from title and alias
          title = title
            .replace(chineseSeasonRegex, "")
            .replace(englishSeasonRegex, "")
            .trim();

          if (alias) {
            alias = alias
              .replace(chineseSeasonRegex, "")
              .replace(englishSeasonRegex, "")
              .trim();
          }
        }

        moviesAndShows.push({
          title,
          alias,
          watchedDate,
          isShow,
          seasonNumber,
        });
      }
    });

    readInterface.on("close", function () {
      resolve(moviesAndShows);
    });

    readInterface.on("error", function (err) {
      reject(err);
    });
  });
}

async function markAsWatched(item, currentCount, totalCount) {
  console.log(
    `[${currentCount}/${totalCount}] Processing: ${item.title} / ${item.alias}`
  );
  try {
    let searchResults = await searchTrakt(item.title, item.isShow);
    if (searchResults.length === 0) {
      console.log(`            Title not found. Trying alias...`);
      searchResults = await searchTrakt(item.alias, item.isShow);
    }

    if (searchResults.length > 0) {
      const traktId = searchResults[0].show
        ? searchResults[0].show.ids.trakt
        : searchResults[0].movie.ids.trakt;
      await syncWatched(traktId, item);
      console.log(
        `            Marked as watched: ${item.title} / ${item.alias}`
      );
      successCount++;
    } else {
      fs.appendFileSync(
        "not_found.txt",
        `${item.title} / ${item.alias} | ${item.watchedDate}\n`
      );
      console.log(`            Could not find: ${item.title} / ${item.alias}`);
      notFoundCount++;
    }
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.log("            Rate limit exceeded. Retrying after delay...");
      await delay(1000); // Wait for 1 second
      await markAsWatched(item, currentCount, totalCount); // Retry
    } else {
      console.error(
        `            Error processing ${item.title}:`,
        error.message
      );
    }
  }
}

async function searchTrakt(query, isShow) {
  const type = isShow ? "show" : "movie";
  console.log(`            Searching Trakt for ${type}: ${query}`);
  const response = await axios.get(
    `${TRAKT_API_BASE}/search/${type}?query=${encodeURIComponent(query)}`,
    {
      headers: traktHeaders(),
    }
  );
  return response.data;
}

async function syncWatched(traktId, item) {
  const type = item.isShow ? "show" : "movie";
  console.log(`            Syncing watched ${type} with Trakt ID: ${traktId}`);
  await axios.post(
    `${TRAKT_API_BASE}/sync/history`,
    {
      [type + "s"]: [
        {
          ids: { trakt: traktId },
          watched_at: item.watchedDate,
        },
      ],
    },
    {
      headers: traktHeaders(),
    }
  );
}

app.get("/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const response = await axios.post("https://api.trakt.tv/oauth/token", {
      code: code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    });

    accessToken = response.data.access_token;
    res.send("Access token obtained. You can now close this window.");

    // Read douban.txt and mark items as watched
    const moviesAndShows = await readDoubanWatchedHistory();
    let currentCount = 0;
    const totalCount = moviesAndShows.length;

    for (const item of moviesAndShows) {
      await markAsWatched(item, currentCount, totalCount);
      currentCount++;
    }
    console.log(
      `Finished processing ${totalCount} items. ${successCount} items successfully marked as watched. ${notFoundCount} items not found.`
    );

    rl.close();
  } catch (error) {
    res.send(`Error obtaining access token: ${error.message}`);
  }
});

const server = app.listen(PORT, async () => {
  console.log(`Server started on http://localhost:${PORT}`);

  const traktAuthURL = `https://trakt.tv/oauth/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}`;
  console.log(
    `Please visit the following URL to authorize the application:\n${traktAuthURL}`
  );

  rl.question("Once authorized, press any key to continue...", (answer) => {
    if (accessToken) {
      console.log("Processing your movies and TV shows from douban.txt...");
    } else {
      console.log("Failed to obtain access token.");
    }
    server.close();
  });
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
