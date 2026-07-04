const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Route and mock API requests to make the test environment independent of the OpenRouter network connection
  await page.route('**/api/analyze', async route => {
    const postData = route.request().postData();
    const body = JSON.parse(postData || '{}');
    const prompt = body.prompt || '';

    let json = {};

    if (prompt.includes('Rewrite the Professional') || prompt.includes('tailor') || prompt.includes('ATS Gap Analysis') || prompt.includes('ORIGINAL RESUME TEXT')) {
      // This is the tailoring request
      json = {
        result: JSON.stringify({
          summary: "Senior React Developer specializing in Tailwind CSS and TypeScript.",
          skills: "React, TypeScript, Tailwind CSS, Vite",
          experience: "React Developer at Tech Corp (2020 - Present)\n- Developed React applications using Vite, TypeScript and Tailwind CSS."
        })
      };
    } else if (prompt.includes('ATS risks') || prompt.includes('stuffing') || prompt.includes('passed') || prompt.includes('issues')) {
      // This is the ATS check request
      json = {
        result: JSON.stringify({
          issues: [],
          passed: true
        })
      };
    } else {
      // This is the Gap Analysis request
      json = {
        result: JSON.stringify({
          missing_keywords: ["React Context", "Vite", "Tailwind CSS"],
          missing_skills: ["TypeScript"],
          weak_sections: [
            {
              section: "Professional Summary",
              issue: "Lack of Tailwind keyword",
              suggestion: "Add Tailwind CSS to the summary"
            }
          ],
          issues: [],
          passed: true
        })
      };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(json)
    });
  });

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173');
  
  // Wait for redirect to /upload
  await page.waitForURL('**/upload');
  console.log('Current URL:', page.url());
  
  // Verify header is present
  const headerText = await page.locator('header').innerText();
  console.log('Header content:', headerText.trim());
  
  // Check if "Analyze" button is disabled
  const analyzeBtn = page.locator('button:has-text("Analyze")');
  console.log('Analyze button disabled initially:', await analyzeBtn.isDisabled());
  
  // Fill in Job Description
  console.log('Filling Job Description...');
  await page.fill('#jd-textarea', 'React Developer with Tailwind CSS and TypeScript experience.');
  
  // Upload resume
  console.log('Uploading resume...');
  const fileInputResume = page.locator('input[type="file"]').first();
  await fileInputResume.setInputFiles('c:/Users/HomePC/Desktop/Resume Forge/test_resume.pdf');
  
  // Upload supporting files (optional)
  console.log('Uploading supporting cert...');
  const fileInputSupport = page.locator('input[type="file"]').nth(1);
  await fileInputSupport.setInputFiles('c:/Users/HomePC/Desktop/Resume Forge/test_cert.docx');
  
  // Verify filenames are visible
  const resumeVisible = await page.locator('text=test_resume.pdf').isVisible();
  const certVisible = await page.locator('text=test_cert.docx').isVisible();
  console.log('Resume file visible:', resumeVisible);
  console.log('Cert file visible:', certVisible);
  
  // Check if "Analyze" button is enabled
  console.log('Analyze button disabled after inputs:', await analyzeBtn.isDisabled());
  
  // Click Analyze
  console.log('Clicking Analyze...');
  await analyzeBtn.click();
  
  // Wait for navigation to /analyze
  await page.waitForURL('**/analyze');
  console.log('Successfully navigated to:', page.url());
  
  // Click "Tailor My Resume"
  console.log('Clicking Tailor My Resume...');
  const tailorBtn = page.locator('button:has-text("Tailor My Resume")');
  await tailorBtn.click();

  // Wait for navigation to /review
  await page.waitForURL('**/review');
  console.log('Successfully navigated to:', page.url());

  // Wait for tailoring loader to disappear
  console.log('Waiting for tailoring content to load...');
  await page.waitForSelector('textarea#tailored-summary');

  // Click "Check ATS Formatting"
  console.log('Clicking Check ATS Formatting...');
  const checkAtsBtn = page.locator('button:has-text("Check ATS Formatting")');
  await checkAtsBtn.click();

  // Wait for navigation to /export
  await page.waitForURL('**/export');
  console.log('Successfully navigated to:', page.url());

  // Wait for formatting check loader to disappear
  console.log('Waiting for ATS check to complete...');
  await page.waitForSelector('text=On-Screen Preview');

  // Verify elements inside preview
  console.log('Verifying preview contents...');
  const nameHeading = page.locator('h1:has-text("Jane Doe")');
  console.log('Jane Doe heading visible in preview:', await nameHeading.isVisible());

  // Verify the font size and color of Jane Doe
  const fontSize = await nameHeading.evaluate(el => window.getComputedStyle(el).fontSize);
  const color = await nameHeading.evaluate(el => window.getComputedStyle(el).color);
  console.log(`Jane Doe font-size: ${fontSize}, color: ${color}`);

  if (fontSize !== '22px') {
    throw new Error(`Expected font size 22px, got ${fontSize}`);
  }
  // color #1F3864 in rgb is rgb(31, 56, 100)
  if (color !== 'rgb(31, 56, 100)') {
    throw new Error(`Expected color rgb(31, 56, 100) (#1F3864), got ${color}`);
  }

  // Click Download as PDF
  console.log('Triggering PDF download...');
  const downloadPdfBtn = page.locator('button:has-text("Download as PDF")');
  // Wait for download to start since it's a browser action
  const downloadPromise = page.waitForEvent('download');
  await downloadPdfBtn.click();
  const download = await downloadPromise;
  console.log('Downloaded file path:', download.suggestedFilename());

  await browser.close();
  console.log('Test completed successfully.');
})().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
