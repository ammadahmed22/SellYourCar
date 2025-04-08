// Configuration
const SPREADSHEET_ID = '1hXNr0Ltg6kBEVA8sjx29Q8uHdLB__kLbxRxMxk_Inoc'; // Your spreadsheet ID
const FOLDER_ID = '1IpBt7xKQFOvZ5PhCVEMSQLUK8PmY9QWS'; // Your folder ID
const MAX_REQUESTS_PER_IP = 3; // Maximum requests allowed per IP in the time window
const TIME_WINDOW_MINUTES = 60; // Time window in minutes for rate limiting
const CACHE_EXPIRATION = 60 * 60; // Cache expiration in seconds (1 hour)
const ALLOWED_ORIGINS = ['https://ammadahmed22.github.io']; // Add your GitHub Pages domain

// Handle OPTIONS request for CORS
function doOptions(e) {
  const headers = {
    'Access-Control-Allow-Origin': 'https://ammadahmed22.github.io',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
  return ContentService.createTextOutput()
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders(headers);
}

// Main function to handle form submissions
function doPost(e) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': 'https://ammadahmed22.github.io',
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    // Get client IP
    const clientIP = getClientIP(e);
    
    // Check rate limit
    if (isRateLimited(clientIP)) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Too many requests. Please try again later.'
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(headers);
    }

    // Parse and validate the form data
    const formData = JSON.parse(e.postData.contents);
    const validationResult = validateFormData(formData);
    
    if (!validationResult.isValid) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: validationResult.message
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(headers);
    }
    
    // Get the spreadsheet and sheet
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getActiveSheet();
    
    // Process images if any
    const imageUrls = formData.images ? processImages(formData.images) : [];
    
    // Combine all vehicle issues into one JSON object
    const vehicleIssues = JSON.stringify({
        mechanical: formData.issues || [],
        engine: formData.engine_issues || [],
        exterior: formData.exterior_damage || [],
        interior: formData.interior_damage || []
    });
    
    // Prepare row data
    const rowData = [
      new Date(), // Timestamp
      formData.name,
      formData.email,
      formData.phone,
      formData.preferredContact,
      formData.make,
      formData.model,
      formData.year,
      formData.mileage,
      formData.vin || 'Not provided',
      formData.price,
      formData.condition,
      formData.zipCode,
      formData.state,
      formData.licensePlate || 'Not provided',
      formData.liens,
      formData.liens === 'yes' ? formData.lienAmount : 'N/A',
      formData.title,
      formData.accidents,
      formData.roadTrip,
      vehicleIssues, // Combined vehicle issues
      formData.modifications,
      formData.smoked,
      formData.notes || '',
      imageUrls.join(', ') // Image URLs as comma-separated string
    ];
    
    // Append data to sheet
    sheet.appendRow(rowData);
    
    // Increment request count for rate limiting
    incrementRequestCount(clientIP);
    
    // Send email notification
    sendNotificationEmail(formData, imageUrls);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Form submitted successfully'
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders(headers);
    
  } catch (error) {
    console.error(error);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders(headers);
  }
}

// Function to validate form data
function validateFormData(data) {
  // Required fields
  const requiredFields = [
    'name', 'email', 'phone', 'preferredContact',
    'make', 'model', 'year', 'mileage', 'condition',
    'zipCode', 'state', 'liens', 'title', 'accidents',
    'roadTrip', 'modifications', 'smoked'
  ];
  
  for (const field of requiredFields) {
    if (!data[field]) {
      return {
        isValid: false,
        message: `Missing required field: ${field}`
      };
    }
  }
  
  // Validate that either VIN or (License Plate + State + ZIP) is provided
  if (!data.vin && (!data.licensePlate || !data.state || !data.zipCode)) {
    return {
      isValid: false,
      message: 'Either VIN or License Plate with State and ZIP is required'
    };
  }
  
  // Validate lien amount if liens is 'yes'
  if (data.liens === 'yes' && !data.lienAmount) {
    return {
      isValid: false,
      message: 'Lien amount is required when liens is yes'
    };
  }
  
  return { isValid: true };
}

// Rate limiting functions
function getClientIP(e) {
  return e.parameter.clientIP || 'unknown';
}

function isRateLimited(clientIP) {
  const cache = CacheService.getScriptCache();
  const count = cache.get(clientIP);
  return count && parseInt(count) >= MAX_REQUESTS_PER_IP;
}

function incrementRequestCount(clientIP) {
  const cache = CacheService.getScriptCache();
  const count = cache.get(clientIP) || 0;
  cache.put(clientIP, parseInt(count) + 1, CACHE_EXPIRATION);
}

// Helper function to create JSON response
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Function to process and upload images
function processImages(images) {
  if (!images || !images.length) return [];
  
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const imageUrls = [];
  
  images.forEach((image, index) => {
    try {
      // Decode base64 image
      const imageBlob = Utilities.newBlob(
        Utilities.base64Decode(image.data),
        image.mimeType,
        image.name
      );
      
      // Upload to Drive
      const file = folder.createFile(imageBlob);
      
      // Set file sharing to anyone with link can view
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      // Get and store the URL
      imageUrls.push(file.getUrl());
    } catch (error) {
      console.error(`Error processing image ${index + 1}:`, error);
    }
  });
  
  return imageUrls;
}

// Function to send email notification
function sendNotificationEmail(formData, imageUrls) {
  const emailAddress = 'YOUR_EMAIL@example.com';
  const subject = `New Car Submission: ${formData.year} ${formData.make} ${formData.model}`;
  
  // Format vehicle issues for better readability
  const mechanicalIssues = formData.issues || [];
  const engineIssues = formData.engine_issues || [];
  const exteriorIssues = formData.exterior_damage || [];
  const interiorIssues = formData.interior_damage || [];

  const formatIssuesList = (issues) => {
    return issues.length > 0 ? issues.map(issue => `  - ${issue}`).join('\n') : '  - None reported';
  };
  
  let body = `
New car submission received:

Personal Information:
- Name: ${formData.name}
- Email: ${formData.email}
- Phone: ${formData.phone}
- Preferred Contact: ${formData.preferredContact}

Vehicle Information:
- Make: ${formData.make}
- Model: ${formData.model}
- Year: ${formData.year}
- Mileage: ${formData.mileage}
- VIN: ${formData.vin || 'Not provided'}
- Expected Price: $${formData.price}
- Condition: ${formData.condition}

Location Information:
- ZIP Code: ${formData.zipCode}
- State: ${formData.state}
- License Plate: ${formData.licensePlate || 'Not provided'}

Ownership Information:
- Liens: ${formData.liens}
${formData.liens === 'yes' ? `- Lien Amount: $${formData.lienAmount}` : ''}
- Title in Hand: ${formData.title}

Vehicle History:
- Accidents: ${formData.accidents}
- Road Trip Ready: ${formData.roadTrip}

Vehicle Issues:
Mechanical & Electrical Issues:
${formatIssuesList(mechanicalIssues)}

Engine Issues:
${formatIssuesList(engineIssues)}

Exterior Damage:
${formatIssuesList(exteriorIssues)}

Interior Damage:
${formatIssuesList(interiorIssues)}

Additional Information:
- Modifications: ${formData.modifications}
- Smoked In: ${formData.smoked}
- Notes: ${formData.notes || 'None provided'}

${imageUrls.length > 0 ? `\nImage Links:\n${imageUrls.join('\n')}` : 'No images provided'}
`;

  MailApp.sendEmail(emailAddress, subject, body);
} 