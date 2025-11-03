import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import * as cheerio from "cheerio";
import axios from "axios";
const newslettersURL = "https://toby.fangamer.com";

const newsletters = existsSync("newsletters.json") ? JSON.parse(readFileSync("newsletters.json", "utf8")) : [];
const saveNewsletters = () => writeFileSync("newsletters.json", JSON.stringify(newsletters, null, 2));
const log = async (data, error) => {
    const timestamp = new Date().toISOString();
    if (error) {
        const errorStr = `[${timestamp}] ${data}: ${error.message}, ${error.stack || 'no stack trace available'}\n`;
        console.error(`[${timestamp}] ${data}:`, error);
        appendFileSync(`errors.log`, errorStr);
    } else {
        console.log(`[${timestamp}] ${data}`);
        appendFileSync(`logs.log`, `[${timestamp}] ${data}\n`);
    };
};
const sleep = (s) => new Promise(resolve => setTimeout(resolve, s * 1000));
const post = async (title, description, url) => {
    try {
        await axios.post(process.env.webhook, { content: "@everyone", embeds: [{ author: { name: "New newsletter!" }, color: 0xffff00, title: title, description: description, url: url }] });
    } catch (e) {
        if (e.status !== 429) throw e;
        await sleep(e.data?.["retry_after"] ?? 10);
        return post(title, description, url);
    };
};
const check = async () => {
    log("Checking for new newsletters...");
    try {
        const newslettersPage = await axios.get(`${newslettersURL}/newsletters`);
        const $ = cheerio.load(newslettersPage.data);
        $("#articles").children().each(async (_, article) => {
            const href = article.attribs['href'];
            if (!newsletters.includes(href)) {
                newsletters.push(href);
                saveNewsletters();
                const url = `${newslettersURL}${href}`;
                const [title, description] = $(article).text().split('\n').map(s => s.trim()).filter(s => s);
                log(`NEW NEWSLETTER! ${url}\n    ${title}\n    ${description}`);
                post(title, description, url);
            };
        });
    } catch (e) {
        log("error", e);
    };
    setTimeout(check, 60000);
};
check();