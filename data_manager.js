const fs = require('fs');
const path = require('path');

const action = process.argv[2];
const dataFilePath = path.join(__dirname, 'site_data.js');

if (action === 'get') {
  try {
    // Delete from cache to get fresh updates
    delete require.cache[require.resolve(dataFilePath)];
    const siteData = require(dataFilePath);
    console.log(JSON.stringify(siteData, null, 2));
  } catch (err) {
    console.error('Error reading site_data.js:', err.message);
    process.exit(1);
  }
} else if (action === 'save') {
  try {
    const tempFilePath = process.argv[3];
    if (!tempFilePath) {
      console.error('Error: Temp file path not provided.');
      process.exit(1);
    }
    
    // Read the temp JSON file
    let rawData = fs.readFileSync(tempFilePath, 'utf-8');
    // Strip UTF-8 BOM if present
    if (rawData.startsWith('\uFEFF')) {
      rawData = rawData.slice(1);
    }
    const parsed = JSON.parse(rawData);
    
    // Write formatted site_data.js
    const fileContent = `const siteData = ${JSON.stringify(parsed, null, 2)};\n\nif (typeof module !== 'undefined' && module.exports) {\n  module.exports = siteData;\n} else if (typeof window !== 'undefined') {\n  window.siteData = siteData;\n}\n`;
    
    fs.writeFileSync(dataFilePath, fileContent, 'utf-8');
    console.log('SUCCESS');
    
    // Clean up temp file
    try {
      fs.unlinkSync(tempFilePath);
    } catch (e) {
      // Ignore cleanup error
    }
  } catch (err) {
    console.error('Error saving data:', err.message);
    process.exit(1);
  }
} else if (action === 'submit-review') {
  try {
    const tempFilePath = process.argv[3];
    if (!tempFilePath) {
      console.error('Error: Temp file path not provided.');
      process.exit(1);
    }
    
    // Read the temp JSON file
    let rawData = fs.readFileSync(tempFilePath, 'utf-8');
    if (rawData.startsWith('\uFEFF')) {
      rawData = rawData.slice(1);
    }
    const newReview = JSON.parse(rawData);
    
    // Load existing database
    delete require.cache[require.resolve(dataFilePath)];
    const siteData = require(dataFilePath);
    
    if (!siteData.reviews) {
      siteData.reviews = [];
    }
    
    // Assign a unique review ID
    const timestamp = Date.now();
    newReview.id = 'rev-' + timestamp;

    // Decode review image if present
    if (newReview.imageData) {
      try {
        const matches = newReview.imageData.match(/^data:image\/([A-Za-z+]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : (matches[1] || 'png');
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          
          const reviewsDir = path.join(__dirname, 'images', 'reviews');
          if (!fs.existsSync(reviewsDir)) {
            fs.mkdirSync(reviewsDir, { recursive: true });
          }
          
          const fileName = `${newReview.id}.${ext}`;
          const filePath = path.join(reviewsDir, fileName);
          fs.writeFileSync(filePath, buffer);
          
          newReview.image = `images/reviews/${fileName}`;
        }
      } catch (imgErr) {
        console.error('Error saving review image:', imgErr.message);
      }
      
      delete newReview.imageData;
      delete newReview.imageName;
    }
    
    // Unshift to place new review at the beginning
    siteData.reviews.unshift(newReview);
    
    // Update matching product's reviewsCount and rating based on literal array of reviews
    if (siteData.products) {
      const product = siteData.products.find(p => p.id === newReview.productId);
      if (product) {
        const productReviews = siteData.reviews.filter(r => r.productId === product.id);
        product.reviewsCount = productReviews.length;
        if (productReviews.length > 0) {
          const totalRating = productReviews.reduce((sum, r) => sum + Number(r.rating), 0);
          product.rating = Number((totalRating / productReviews.length).toFixed(1));
        } else {
          product.rating = 5.0;
        }
      }
    }
    
    // Write formatted site_data.js
    const fileContent = `const siteData = ${JSON.stringify(siteData, null, 2)};\n\nif (typeof module !== 'undefined' && module.exports) {\n  module.exports = siteData;\n} else if (typeof window !== 'undefined') {\n  window.siteData = siteData;\n}\n`;
    
    fs.writeFileSync(dataFilePath, fileContent, 'utf-8');
    console.log('SUCCESS SUBMIT REVIEW');
    
    // Clean up temp file
    try {
      fs.unlinkSync(tempFilePath);
    } catch (e) {
      // Ignore
    }
  } catch (err) {
    console.error('Error submitting review:', err.message);
    process.exit(1);
  }
} else {
  console.error('Error: Invalid action.', action);
  process.exit(1);
}
