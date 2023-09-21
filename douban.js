const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const cookies = "YOUR_COOKIES_HERE";
const userID = "YOUR_USER_ID_HERE";
const BASE_URL = `https://movie.douban.com/people/${userID}/collect?start=`;
const ITEMS_PER_PAGE = 15;

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.douban.com/",
};

async function getTotalPages() {
  const response = await axios.get(BASE_URL + "0", {
    headers: { ...headers, Cookie: cookies },
  });

  const $ = cheerio.load(response.data);
  const totalPages = parseInt(
    $(".paginator .thispage").attr("data-total-page")
  );
  return totalPages;
}

function saveMoviesToFile(movies) {
  // Append movies to the file
  fs.appendFileSync("douban_watched_history.txt", movies.join("\n") + "\n");
}

async function extractMoviesFromPage(pageNumber) {
  const response = await axios.get(BASE_URL + pageNumber * ITEMS_PER_PAGE, {
    headers: { ...headers, Cookie: cookies },
  });
  const $ = cheerio.load(response.data);
  const movies = [];

  $(".item.comment-item").each((index, element) => {
    const link = $(element).find(".title a").attr("href");
    const title = $(element).find(".title a em").text();
    const date = $(element).find(".date").text();
    movies.push(`${link} | ${title} | ${date}`);
  });

  return movies;
}

async function main() {
  const totalPages = await getTotalPages();

  // Clear or create the file before writing
  fs.writeFileSync("douban_movies.txt", "");

  for (let i = 0; i < totalPages; i++) {
    const movies = await extractMoviesFromPage(i);
    saveMoviesToFile(movies);
    // log the progress
    console.log(`Page ${i + 1} of ${totalPages} extracted.`);
    // wait for 1 second before extracting the next page
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("Data extraction completed.");
}

main().catch((error) => {
  console.error("Error:", error.message);
});
