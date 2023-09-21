# Douban to Trakt

This is a small tool synchronize your douban watched history with trakt

## Usage

1. **Install dependencies**

Run following code in terminal to install the dependencies

```bash
npm install
```


2. **Open `douban.js` and replace following line with your information**
   
```javascript
const COOKIES = "YOUR_COOKIES_HERE";
const USER_ID = "YOUR_USER_ID_HERE";
```

> The login cookie is used to avoid `403 Forbidden error`. Although the watched history is public accessable via `https://movie.douban.com/people/{USER_ID}/collect`. But there still is a high chance the server identify your requests as non-human and return `403 Forbidden error` if you don't add cookies for the request.

> ### Extracting Your Douban Cookies:
> 
> 1. Log in to the website using a browser.
> 2. Open the developer tools (usually F12 or right-click and select "Inspect").
> 3. Go to the "Network" tab.
> 4. Refresh the page and select the first request to the website.
> 5. Look for the "Cookies" section in the request headers.
> 6. Copy the cookies.

3. **Get douban watched history**

Run the following code in terminal to get the Douban watch history

```bash
node douban.js
```

The collected douban watched history will be saved in `douban_watched_history.txt` in following format `{Douban URI} | {title} | {watched date}`

```text
https://movie.douban.com/subject/26258779/ | 银河护卫队3 / Guardians of the Galaxy Vol. 3 | 2023-09-21
https://movie.douban.com/subject/3819860/ | 夺宝奇兵5：命运转盘 / Indiana Jones and the Dial of Destiny | 2023-09-02
https://movie.douban.com/subject/1959877/ | 崖上的波妞 / 崖の上のポニョ | 2023-08-24
https://movie.douban.com/subject/2279152/ | 名侦探柯南：世纪末的魔术师 / 名探偵コナン 世紀末の魔術師 | 2023-08-12
...
```

4. **Setup Trakt API**:

- Sign up for a Trakt account if you haven't already.
- Register your app on Trakt to get an API key: Trakt API Docs https://trakt.docs.apiary.io/#
- Note down the Client ID and Client Secret.

> ### How to get `Client ID` and `Client Secret`
> 
> When creating a Trakt API app via https://trakt.tv/oauth/applications, you'll need to provide some details to set up the OAuth 2.0 flow. Here's what you should put in each field:
> 1. Name:
> - This should be a descriptive name for your application. It's what users will see when they're asked to grant your application access to their Trakt account.
> - Example: "My Movie Tracker App"
> 2. Redirect URI:
> - This is the URL where Trakt will redirect users after they've authorized (or denied) your application. Your application should be set up to handle this redirect and extract the authorization code from the URL.
> - For local development, you can use: http://localhost:3000/callback
> - *Note: It's essential that the redirect URI you specify here matches the one you use in your code.*
> 3. Javascript (CORS) origins:
> - This field is for specifying domains that are allowed to make cross-origin requests to the Trakt API from the browser. If you're building a web application that makes requests directly from the user's browser (using JavaScript), you'll need to specify the domain here to avoid CORS (Cross-Origin Resource Sharing) issues.
> - For local development, you can use: http://localhost:3000
>
> After filling out these fields and any other necessary details, you can proceed to create the app on Trakt. Once created, you'll be provided with a Client ID and Client Secret, which you'll use in your application to interact with the Trakt API.

After you get the Client ID and Client Secret, open `trakt.js` and replace following line with your information

```javascript
const CLIENT_ID = "YOUR_CLIENT_ID_HERE";
const CLIENT_SECRET = "YOUR_CLIENT_SECRET_HERE";
```

5. **Start Synchronization**

Run the following code start synchronization history to Trakt

```bash
node trakt.js
```

Follow the guidance process for OAuth authentication
```
Server started on http://localhost:3000
Please visit the following URL to authorize the application:
https://trakt.tv/oauth/authorize?response_type=code&client_id=xyz&redirect_uri=http://localhost:3000/callback
Once authorized, press any key to continue...'
```

```bash
[0/1167] Processing: 银河护卫队3 / Guardians of the Galaxy Vol. 3
            Searching Trakt for movie: 银河护卫队3
            Syncing watched movie with Trakt ID: 293990
            Marked as watched: 银河护卫队3 / Guardians of the Galaxy Vol. 3
[1/1167] Processing: 夺宝奇兵5：命运转盘 / Indiana Jones and the Dial of Destiny
            Searching Trakt for movie: 夺宝奇兵5：命运转盘
            Syncing watched movie with Trakt ID: 216712
            Rate limit exceeded. Retrying after delay...
[1/1167] Processing: 夺宝奇兵5：命运转盘 / Indiana Jones and the Dial of Destiny
            Searching Trakt for movie: 夺宝奇兵5：命运转盘
            Syncing watched movie with Trakt ID: 216712
            Marked as watched: 夺宝奇兵5：命运转盘 / Indiana Jones and the Dial of Destiny
[2/1167] Processing: 崖上的波妞 / 崖の上のポニョ
            Searching Trakt for movie: 崖上的波妞
            Syncing watched movie with Trakt ID: 7217
            Marked as watched: 崖上的波妞 / 崖の上のポニョ
[3/1167] Processing: 名侦探柯南：世纪末的魔术师 / 名探偵コナン 世紀末の魔術師
            Searching Trakt for movie: 名侦探柯南：世纪末的魔术师
            Syncing watched movie with Trakt ID: 18041
            Marked as watched: 名侦探柯南：世纪末的魔术师 / 名探偵コナン 世紀末の魔術師
...
```

The searching and marking process explanation:

1. Iterate the entry in the `douban_watched_history.txt`
2. Determine whether it is a show or movie based on the collected douban watched history title
3. Search trakt ID based on title
4. (if title is not found) Search trakt ID based on alias
5. (if alias is not found) Save the entry to `not_found.txt`
6. Retry the current entry with a delay of 1 second after receive `429	Rate Limit Exceeded` error 

