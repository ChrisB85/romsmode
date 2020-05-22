"use strict";

const config = require("config");
const playwright = require("playwright-chromium");
const dir = config.get('downloadDir');
const downloadFile = config.get('downloadFile');
const url = config.get('url');
const browserType = "chromium";

var fs = require('fs');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

var browser;
var currentPage = 1;
var pagesCount;
var page;
var pageLinks = [];
var allLinks = [];
var currentGame = 0;

(async () => {
    browser = await playwright[browserType].launch({
        // headless: false
    });

    let context = await browser.newContext({
        acceptDownloads: true
    });

    page = await context.newPage({
        acceptDownloads: true
    });

    try {
        var fileData = fs.readFileSync(downloadFile, "utf-8");
        allLinks = JSON.parse(fileData);
        if (allLinks.length > 0) {
            console.log(`Download links restored from ${downloadFile}`);
        }
    } catch (error) {
        allLinks = [];
    }

    if (allLinks.length == 0) {
        await page.goto(url);
        pagesCount = await getPages(page);
        await processPage();
    } else {
        processlinks();
    }
})();

async function processPage() {
    console.log(`Processing page ${currentPage}/${pagesCount}...`);
    await page.goto(`${url}/${currentPage}`);

    var links = await page.$$('.link');
    links.forEach(async (link) => {
        let gameUrl = await link.getAttribute('href');
        pageLinks.push(gameUrl);
        if (pageLinks.length == links.length) {
            allLinks = allLinks.concat(pageLinks);
            currentPage++;
            pageLinks = [];
            if (currentPage <= pagesCount) {
                await processPage();
            } else {
                // All pages processed
                console.log(`All pages processed!`);
                for (let index = 0; index < allLinks.length; index++) {
                    allLinks[index] = allLinks[index].replace(/\/roms\//, '/download/roms/');
                }
                // Save links to file
                console.log(`Saving download links...`);
                fs.writeFileSync(
                    downloadFile,
                    JSON.stringify(allLinks)
                );
                processlinks();
            }
        }
    });
}

async function processlinks() {
    console.log(`Processing link [${currentGame + 1}/${allLinks.length}] ${allLinks[currentGame]}`);
    await page.goto(allLinks[currentGame]);
    const [download] = await Promise.all([
        page.waitForEvent('download'), // wait for download to start
        page.click('.wait__link')
    ]);
    // wait for download to complete
    var path = await download.path();
    var url = decodeURI(await download.url());
    var fileName = url.split('/').slice(-1).pop();
    console.log(`ROM saved as ${fileName}`);
    fs.copyFile(path, dir + fileName, async (err) => {
        if (err) { throw err };
        await download.delete();
    });

    allLinks[currentGame] = null;

    var filteredLinks = allLinks.filter(function (el) {
        return el != null;
    });

    fs.writeFileSync(
        downloadFile,
        JSON.stringify(filteredLinks)
    );

    currentGame++;
    if (currentGame < allLinks.length) {
        processlinks();
    } else {
        await browser.close();
        process.exit();
    }
}

async function getPages(page) {
    var lis = await page.$$('.pagination__link');
    var lastPage = await page.$(`.pagination__list li:nth-child(${lis.length})`);
    return await lastPage.innerText();
}