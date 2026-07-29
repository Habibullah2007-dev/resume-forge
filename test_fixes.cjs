const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.error(`[Browser PageError] ${err.message}`));
  page.on('request', request => console.log(`[Browser Request] ${request.method()} ${request.url()}`));
  page.on('requestfailed', request => console.log(`[Browser Request Failed] ${request.method()} ${request.url()} - ${request.failure()?.errorText}`));

  const mockAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCIsImVtYWlsIjoidGVzdHVzZXJAZ21haWwuY29tIiwic3ViIjoiZWMyZGY0MWMtYzMwYi00MWU5LWFhYzYtOGZiZmNlMzAyZjYwIiwiZXhwIjoyMDk4Nzc3MTExfQ.signature';

  // Will set mock Supabase session after first navigation instead of addInitScript

  // Keep track of our mock database history items in memory
  let mockHistory = [];

  // Mock Supabase Auth API
  await page.route('**/auth/v1/**', async route => {
    const method = route.request().method();
    const url = route.request().url();
    console.log(`[Supabase Auth Mock] Intercepted ${method} request to ${url}`);
    
    if (url.includes('/token') || url.includes('/session')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: mockAccessToken,
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
          user: {
            id: 'ec2df41c-c30b-41e9-aac6-8fbfce302f60',
            email: 'testuser@gmail.com',
            role: 'authenticated'
          }
        })
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ec2df41c-c30b-41e9-aac6-8fbfce302f60',
          email: 'testuser@gmail.com',
          role: 'authenticated'
        })
      });
    }
  });

  // Mock all API calls
  await page.route('**/api/analyze', async route => {
    const postData = route.request().postData();
    const body = JSON.parse(postData || '{}');
    const prompt = body.prompt || '';

    let json = {};

    if (prompt.includes('Extract all relevant information') || prompt.includes('tailor') || prompt.includes('tailored resume')) {
      // This is the tailoring request with supporting documents merge instruction
      json = {
        result: JSON.stringify({
          summary: "Senior React Developer specializing in Tailwind CSS and TypeScript.",
          skills: "React, TypeScript, Tailwind CSS, Vite, AWS Certified Solutions Architect",
          experience: "React Developer at Tech Corp (2020 - Present)\n- Developed React applications using Vite, TypeScript and Tailwind CSS.",
          education: "B.Sc. Computer Science - University of Jos (2018-2022)\n- GPA: 3.9/4.0\n- Dean's List (2020, 2021)",
          certifications: "AWS Certified Solutions Architect (2025)",
          awards: "Dean's List Award (2021)",
          supporting_doc_adds: [
            "Added AWS Certified Solutions Architect to Certifications",
            "Added GPA 3.9/4.0 and Dean's List to Education"
          ]
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
          ]
        })
      };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(json)
    });
  });

  // Mock Supabase REST endpoints
  await page.route('**/rest/v1/analyzed_resumes**', async route => {
    const method = route.request().method();
    const url = route.request().url();

    console.log(`[Supabase Mock] Intercepted ${method} request to ${url}`);

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHistory)
      });
    } else if (method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      const newRecord = {
        id: `mock-uuid-${Date.now()}`,
        created_at: new Date().toISOString(),
        ...body
      };
      mockHistory.push(newRecord);
      
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([newRecord])
      });
    } else if (method === 'DELETE') {
      const match = url.match(/id=eq\.([^&]+)/);
      if (match) {
        const idToDelete = match[1];
        mockHistory = mockHistory.filter(item => item.id !== idToDelete);
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: "Deleted successfully" })
      });
    }
  });

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173');

  console.log('Setting localStorage session token...');
  await page.evaluate(({ token }) => {
    window.localStorage.setItem('sb-rtevqrdicdrgemcgwguh-auth-token', JSON.stringify({
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'mock-refresh-token',
      user: {
        id: 'ec2df41c-c30b-41e9-aac6-8fbfce302f60',
        email: 'testuser@gmail.com',
        role: 'authenticated'
      }
    }));
  }, { token: mockAccessToken });

  console.log('Navigating to http://localhost:5173/upload...');
  await page.goto('http://localhost:5173/upload');
  await page.waitForURL('**/upload');
  console.log('Current URL:', page.url());
  
  // Fill in Job Description with clear first line (Job Title)
  console.log('Filling Job Description...');
  await page.fill('#jd-textarea', 'Lead React Architect\n\nRequirements:\nReact Developer with Tailwind CSS and TypeScript experience.');
  
  // Set files
  console.log('Setting files...');
  const fileInputResume = page.locator('input[type="file"]').first();
  await fileInputResume.setInputFiles('test_resume.pdf');
  
  const fileInputSupport = page.locator('input[type="file"]').nth(1);
  await fileInputSupport.setInputFiles('test_cert.docx');
  
  // Verify filenames are visible
  const resumeVisible = await page.locator('text=test_resume.pdf').isVisible();
  const certVisible = await page.locator('text=test_cert.docx').isVisible();
  console.log('Resume file visible:', resumeVisible);
  console.log('Cert file visible:', certVisible);
  
  // Click Analyze
  console.log('Clicking Analyze...');
  await page.locator('button:has-text("Analyze")').click();
  
  // Wait for navigation to /analyze
  await page.waitForURL('**/analyze');
  console.log('Successfully navigated to /analyze');
  
  // Click "Tailor My Resume"
  console.log('Clicking Tailor My Resume...');
  await page.locator('button:has-text("Tailor My Resume")').click();
  
  // Wait for navigation to /review
  await page.waitForURL('**/review');
  console.log('Successfully navigated to /review');
 
  // Wait for tailoring content to load
  await page.waitForSelector('textarea#tailored-summary');
  
  // Verify supporting documents extraction summary is visible
  const addsSummaryVisible = await page.locator('text=From your supporting documents, we added:').isVisible();
  console.log('Supporting doc adds summary visible on Review screen:', addsSummaryVisible);
  if (!addsSummaryVisible) {
    throw new Error('Supporting documents summary banner was not displayed on Review screen');
  }

  // Check the Job Title input field is pre-populated on Review screen
  const jobTitleVal = await page.locator('input#job-title-input').inputValue();
  console.log('Prefilled Job Title input value on Review:', jobTitleVal);
  if (jobTitleVal !== 'Lead React Architect') {
    throw new Error(`Expected prefilled job title "Lead React Architect" on Review, got "${jobTitleVal}"`);
  }

  // Click Save to History on Review screen
  console.log('Clicking Done — Save to History...');
  await page.locator('button:has-text("Done — Save to History")').click();

  // Wait for success confirmation
  console.log('Waiting for success confirmation...');
  await page.waitForSelector('text=Saved to your history ✓');
  console.log('Confirmation message visible!');

  // Click "Check ATS Formatting" to navigate to /export
  console.log('Clicking Check ATS Formatting...');
  await page.locator('button:has-text("Check ATS Formatting")').click();
  
  // Wait for navigation to /export
  await page.waitForURL('**/export');
  console.log('Successfully navigated to /export');
 
  // Wait for page load
  await page.waitForSelector('text=On-Screen Preview');

  // Verify certifications section on the preview contains the certificate
  const previewText = await page.locator('text=Certifications').evaluate(el => el.parentElement?.parentElement?.innerText || '');
  console.log('Certifications preview content:', previewText);
  if (!previewText.includes('AWS Certified Solutions Architect')) {
    throw new Error('Certifications section did not contain AWS Certified Solutions Architect in resume preview');
  }

  // Navigate to history using header link since we are on /export
  console.log('Clicking History in header...');
  await page.locator('header button:has-text("History")').click();
  await page.waitForURL('**/history');
  console.log('Successfully navigated to /history');

  // Verify the record is listed in History with correct title and reload button
  const recordTitle = await page.locator('.grid h3').first().innerText();
  console.log('History record title:', recordTitle);
  if (recordTitle !== 'Lead React Architect') {
    throw new Error(`Expected record title in history "Lead React Architect", got "${recordTitle}"`);
  }

  // Click Reload & Edit
  console.log('Clicking Reload & Edit...');
  await page.locator('button:has-text("Reload & Edit")').click();
  await page.waitForURL('**/review');
  console.log('Successfully reloaded and navigated back to /review');

  // Verify we are back on Review page with states populated
  const reloadedSummary = await page.locator('textarea#tailored-summary').inputValue();
  console.log('Reloaded Summary value:', reloadedSummary);
  if (!reloadedSummary.includes('TypeScript')) {
    throw new Error('Reloaded states were empty or incorrect');
  }

  // Navigate back to history
  console.log('Navigating back to history...');
  await page.goto('http://localhost:5173/history');
  await page.waitForURL('**/history');

  // Click Delete
  console.log('Clicking Delete...');
  // Handle confirm dialog automatically
  page.once('dialog', async dialog => {
    console.log(`Dialog message: ${dialog.message()}`);
    await dialog.accept();
  });
  await page.locator('button:has-text("Delete")').click();

  // Verify history is empty
  await page.waitForSelector('text=No resumes tailored yet');
  console.log('History record deleted successfully!');

  await browser.close();
  console.log('All tests completed successfully!');
})().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
