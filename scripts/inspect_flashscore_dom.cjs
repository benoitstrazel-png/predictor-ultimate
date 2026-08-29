const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

async function inspect() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  console.log('Navigating to Lille vs PSG lineups...');
  await page.goto('https://www.flashscore.com/match/football/lille-pfDZL71o/psg-CjhkPw0k/?mid=INhYSVse#/match-summary/lineups', { waitUntil: 'networkidle2', timeout: 35000 });
  await new Promise(r => setTimeout(r, 2000));

  const inspection = await page.evaluate(() => {
    // Collect all elements with class containing 'lineup' or 'participant' or 'formation'
    const elements = [];
    document.querySelectorAll('*').forEach(el => {
      const cls = el.className;
      if (typeof cls === 'string' && (cls.includes('lineup') || cls.includes('formation') || cls.includes('lf__') || cls.includes('wcl-participant'))) {
        elements.push({ tag: el.tagName, class: cls, text: el.innerText ? el.innerText.trim().slice(0, 100) : '' });
      }
    });

    const fullText = document.body.innerText;
    return { elements: elements.slice(0, 50), fullText: fullText.slice(0, 4000) };
  });

  console.log('Full Text:\n', inspection.fullText);
  fs.writeFileSync('flashscore_lineups_dump.txt', inspection.fullText, 'utf8');
  await browser.close();
}

inspect().catch(console.error);