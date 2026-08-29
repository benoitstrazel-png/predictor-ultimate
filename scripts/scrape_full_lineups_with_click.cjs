const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

async function testClickLineup() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  console.log('Loading page...');
  await page.goto('https://www.flashscore.com/match/football/lille-pfDZL71o/psg-CjhkPw0k/?mid=INhYSVse', { waitUntil: 'networkidle2', timeout: 35000 });

  try {
    const cookie = await page.$('#onetrust-accept-btn-handler');
    if (cookie) await cookie.click();
  } catch(e) {}

  await new Promise(r => setTimeout(r, 1000));

  // Find and click LINEUPS tab
  console.log('Clicking LINEUPS tab button...');
  const clicked = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('a, button, div'));
    const lineupBtn = tabs.find(el => el.innerText && el.innerText.trim().toUpperCase() === 'LINEUPS');
    if (lineupBtn) {
      lineupBtn.click();
      return true;
    }
    return false;
  });
  console.log('Lineup button clicked:', clicked);

  await new Promise(r => setTimeout(r, 3000));

  const result = await page.evaluate(() => {
    const homePlayers = [];
    const awayPlayers = [];
    const homeBench = [];
    const awayBench = [];

    // Let's examine the structure: Flashscore Lineup has Home and Away columns
    const homeColumn = document.querySelector('.lf__side--home, [class*="lineup--home"], .wcl-home_');
    const awayColumn = document.querySelector('.lf__side--away, [class*="lineup--away"], .wcl-away_');
    
    // Or two sections / lineup tables
    const tables = document.querySelectorAll('.lineupTable, .wcl-table_, [class*="lineupTable"]');
    
    // Or two sides inside lineup
    const sides = document.querySelectorAll('.lf__side, [class*="lineupSide"], .wcl-side_');

    return {
      homeColFound: !!homeColumn,
      awayColFound: !!awayColumn,
      tablesCount: tables.length,
      sidesCount: sides.length,
      textSnippet: document.body.innerText.slice(0, 3000)
    };
  });

  console.log('Result:', result);
  fs.writeFileSync('flashscore_lineups_clicked.txt', result.textSnippet, 'utf8');
  await browser.close();
}

testClickLineup().catch(console.error);