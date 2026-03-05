const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

// 查找 Chrome 可执行文件路径
function findChrome() {
  const possiblePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  
  for (const chromePath of possiblePaths) {
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  }
  
  throw new Error('未找到 Chrome 浏览器。请安装 Google Chrome 或 Chromium。');
}

async function runBrowserTest() {
  const executablePath = findChrome();
  console.log('使用浏览器:', executablePath);
  
  const browser = await puppeteer.launch({ 
    headless: false,
    executablePath,
    defaultViewport: { width: 1280, height: 800 }
  });
  const page = await browser.newPage();

  try {
    console.log('步骤 1: 访问主页 http://localhost:3000');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.screenshot({ path: 'screenshots/01-homepage.png', fullPage: true });
    console.log('✓ 截图已保存: screenshots/01-homepage.png');

    console.log('\n步骤 2: 点击 "Agent 注册" 按钮');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('Agent 注册'));
      if (btn) btn.click();
    });
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({ path: 'screenshots/02-register-panel.png', fullPage: true });
    console.log('✓ 截图已保存: screenshots/02-register-panel.png');

    console.log('\n步骤 3: 填写注册表单');
    await page.type('#agentName', 'browser-test-agent');
    await page.type('#agentEmail', 'test@example.com');
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({ path: 'screenshots/03-form-filled.png', fullPage: true });
    console.log('✓ 截图已保存: screenshots/03-form-filled.png');

    console.log('\n步骤 4: 点击绿色 "注册" 按钮');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('注册') && !b.textContent.includes('Agent'));
      if (btn) btn.click();
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    await page.screenshot({ path: 'screenshots/04-api-key-result.png', fullPage: true });
    console.log('✓ 截图已保存: screenshots/04-api-key-result.png');

    console.log('\n步骤 5: 点击 "上传 Skill" 按钮');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('上传 Skill'));
      if (btn) btn.click();
    });
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({ path: 'screenshots/05-upload-panel.png', fullPage: true });
    console.log('✓ 截图已保存: screenshots/05-upload-panel.png');

    console.log('\n步骤 6: 点击 "API 状态" 按钮');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('API 状态'));
      if (btn) btn.click();
    });
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({ path: 'screenshots/06-api-status.png', fullPage: true });
    console.log('✓ 截图已保存: screenshots/06-api-status.png');

    console.log('\n步骤 7: 访问 Swagger UI 页面');
    await page.goto('http://localhost:3000/api/docs', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: 'screenshots/07-swagger-ui.png', fullPage: true });
    console.log('✓ 截图已保存: screenshots/07-swagger-ui.png');

    console.log('\n✅ 所有测试步骤完成！截图已保存到 screenshots/ 目录');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    await page.screenshot({ path: 'screenshots/error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

// 创建截图目录
if (!fs.existsSync('screenshots')) {
  fs.mkdirSync('screenshots');
}

runBrowserTest().catch(console.error);
