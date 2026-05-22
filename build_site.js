const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Load site data
console.log('Loading site data...');
let siteData;
try {
  siteData = require('./site_data.js');
} catch (err) {
  console.error('Error: Could not load site_data.js. Make sure it exists and has no syntax errors.', err);
  process.exit(1);
}

// Ensure output directories exist
fs.mkdirSync(path.join(__dirname, 'product'), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'category'), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'blog'), { recursive: true });

// 2. Read template files
console.log('Reading templates...');
const templatesDir = path.join(__dirname, 'templates');
const readTemplate = (filename) => fs.readFileSync(path.join(templatesDir, filename), 'utf-8');

const layoutTemplate = readTemplate('layout.html');
const indexTemplate = readTemplate('index.html');
const shopTemplate = readTemplate('shop.html');
const productTemplate = readTemplate('product.html');
const categoryTemplate = readTemplate('category.html');
const aboutTemplate = readTemplate('about.html');
const contactTemplate = readTemplate('contact.html');
const blogTemplate = readTemplate('blog.html');
const blogDetailTemplate = readTemplate('blog_detail.html');
const error404Template = readTemplate('404.html');

// Helper to generate star ratings
function generateStarsHTML(rating) {
  let stars = '';
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  for (let i = 1; i <= 5; i++) {
    if (i <= fullStars) {
      stars += '★'; // Solid Star
    } else if (i === fullStars + 1 && hasHalf) {
      stars += '★'; // We can use solid for simplicity, or half if needed
    } else {
      stars += '☆'; // Empty Star
    }
  }
  return stars;
}

// Helper to fill layout placeholders
function compilePage(contentHTML, pageTitle, pageDesc, pathPrefix = '', activeNav = '', extraHead = '') {
  let footerCategoriesHTML = '';
  siteData.categories.forEach(cat => {
    footerCategoriesHTML += `<li><a href="${pathPrefix}category/${cat.id}" class="hover:text-white transition-colors">${cat.name}</a></li>\n`;
  });

  const resolveAssetPath = (filePath) => {
    if (!filePath) return '';
    if (pathPrefix === '/') {
      return '/' + filePath.replace(/^\//, '');
    }
    return pathPrefix + filePath;
  };

  const homeURL = pathPrefix === '../' ? '../home' : '/home';

  let html = layoutTemplate
    .replace(/\{\{CONTENT\}\}/g, contentHTML)
    .replace(/\{\{PATH_PREFIX\}\}index/g, homeURL)
    .replace(/\{\{PAGE_TITLE\}\}/g, pageTitle)
    .replace(/\{\{PAGE_DESCRIPTION\}\}/g, pageDesc)
    .replace(/\{\{SITE_NAME\}\}/g, siteData.settings.siteName)
    .replace(/\{\{LOGO_IMAGE\}\}/g, resolveAssetPath(siteData.settings.logoImage || 'images/logo/logo.png'))
    .replace(/\{\{FAVICON_IMAGE\}\}/g, resolveAssetPath(siteData.settings.faviconImage || 'images/logo/favicon.png'))
    .replace(/\{\{FOOTER_ABOUT_TEXT\}\}/g, siteData.settings.footerAboutText)
    .replace(/\{\{FACEBOOK_URL\}\}/g, siteData.settings.facebookUrl)
    .replace(/\{\{INSTAGRAM_URL\}\}/g, siteData.settings.instagramUrl)
    .replace(/\{\{TIKTOK_URL\}\}/g, siteData.settings.tiktokUrl || '')
    .replace(/\{\{CONTACT_ADDRESS\}\}/g, siteData.settings.address)
    .replace(/\{\{CONTACT_PHONE\}\}/g, siteData.settings.contactPhone)
    .replace(/\{\{CONTACT_EMAIL\}\}/g, siteData.settings.contactEmail)
    .replace(/\{\{WHATSAPP_NUMBER\}\}/g, siteData.settings.whatsappNumber)
    .replace(/\{\{INSIDE_CHAPAIFEE\}\}/g, siteData.settings.insideChapaiDeliveryFee)
    .replace(/\{\{OUTSIDE_CHAPAIFEE\}\}/g, siteData.settings.outsideChapaiDeliveryFee)
    .replace(/\{\{PATH_PREFIX\}\}/g, pathPrefix)
    .replace(/\{\{FOOTER_CATEGORIES\}\}/g, footerCategoriesHTML)
    .replace(/\{\{COUPONS_JSON\}\}/g, JSON.stringify(siteData.coupons || []))
    .replace(/\{\{EXTRA_HEAD\}\}/g, extraHead);

  // Set active class for navigation
  html = html
    .replace(/\{\{NAV_ACTIVE_HOME\}\}/g, activeNav === 'home' ? 'text-brand-500 font-semibold border-b-2 border-brand-500' : 'text-slate-600')
    .replace(/\{\{NAV_ACTIVE_SHOP\}\}/g, activeNav === 'shop' ? 'text-brand-500 font-semibold border-b-2 border-brand-500' : 'text-slate-600')
    .replace(/\{\{NAV_ACTIVE_ABOUT\}\}/g, activeNav === 'about' ? 'text-brand-500 font-semibold border-b-2 border-brand-500' : 'text-slate-600')
    .replace(/\{\{NAV_ACTIVE_BLOG\}\}/g, activeNav === 'blog' ? 'text-brand-500 font-semibold border-b-2 border-brand-500' : 'text-slate-600')
    .replace(/\{\{NAV_ACTIVE_CONTACT\}\}/g, activeNav === 'contact' ? 'text-brand-500 font-semibold border-b-2 border-brand-500' : 'text-slate-600');

  return html;
}

// Generate product card HTML
function renderProductCard(product, prefix = '', index = 0) {
  // Filter reviews for this product dynamically
  const productReviews = (siteData.reviews || []).filter(r => r.productId === product.id);
  const reviewsCount = productReviews.length;
  let rating = 5;
  if (productReviews.length > 0) {
    const totalRating = productReviews.reduce((sum, r) => sum + Number(r.rating), 0);
    rating = Number((totalRating / productReviews.length).toFixed(1));
  }

  const badgesHTML = `
    ${product.isNew ? `<span class="px-2.5 py-1 text-[10px] font-bold bg-brand-500 text-white rounded-full uppercase tracking-wider">নতুন</span>` : ''}
    ${product.isBestSeller ? `<span class="px-2.5 py-1 text-[10px] font-bold bg-accent-orange text-white rounded-full uppercase tracking-wider">বেস্ট সেলার</span>` : ''}
  `;

  return `
  <div class="product-card-item bg-white rounded-2xl border border-brand-100 p-4 hover-glow flex flex-col justify-between group relative transition-custom"
       data-category="${product.category}"
       data-price="${product.price}"
       data-rating="${rating}"
       data-name="${product.name}"
       data-in-stock="${product.inStock}"
       data-index="${index}">
       
    <!-- Badges -->
    <div class="absolute top-4 left-4 z-10 flex flex-col gap-1">
      ${badgesHTML}
    </div>
    
    <!-- Image -->
    <a href="${prefix}product/${product.id}" class="h-48 w-full bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center p-3 mb-4">
      <img src="${prefix}${product.image}" alt="${product.name}" loading="lazy" width="240" height="240" class="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300">
    </a>

    <!-- Details -->
    <div class="space-y-2 flex-grow flex flex-col justify-between">
      <div>
        <div class="flex items-center gap-1 text-amber-400 text-xs">
          ${generateStarsHTML(rating)}
          <span class="text-slate-400 font-medium ml-1">(${reviewsCount})</span>
        </div>
        <a href="${prefix}product/${product.id}" class="block mt-1">
          <h3 class="text-base font-bold text-slate-800 hover:text-brand-500 transition-colors leading-snug font-sans">${product.name}</h3>
        </a>
      </div>

      <!-- Pricing & Actions -->
      <div class="flex items-center justify-between pt-3 border-t border-slate-50">
        <div class="flex flex-col">
          <span class="text-[10px] text-slate-400 font-medium font-sans">প্রতি ${product.unit}</span>
          <div class="flex items-baseline gap-1.5">
            <span class="text-base font-bold text-brand-600 font-serif">${product.price} টাকা</span>
            <span class="text-xs text-slate-400 line-through font-serif">${product.originalPrice} টাকা</span>
          </div>
        </div>

        ${product.inStock ? `
        <button onclick="window.dispatchEvent(new CustomEvent('add-to-cart-event', { detail: { id: '${product.id}', name: '${product.name.replace(/'/g, "\\'")}', price: ${product.price}, unit: '${product.unit}', image: '${product.image}', qty: 1 } }))"
                class="w-9 h-9 rounded-full bg-brand-50 hover:bg-brand-500 text-brand-600 hover:text-white flex items-center justify-center transition-all shadow-xs border border-brand-100 hover:border-brand-500 cursor-pointer" 
                aria-label="Add to cart">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
        ` : `
        <span class="text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded">স্টক শেষ</span>
        `}
      </div>
    </div>
  </div>
  `;
}

// Generate blog card HTML
function renderBlogCard(blog, prefix = '') {
  return `
  <div class="bg-white rounded-2xl border border-brand-100 overflow-hidden hover-glow flex flex-col justify-between group transition-custom">
    <div>
      <!-- Image -->
      <a href="${prefix}blog/${blog.id}" class="block aspect-video w-full overflow-hidden bg-slate-50 border-b border-slate-50">
        <img src="${prefix}${blog.image}" alt="${blog.title}" loading="lazy" width="400" height="250" class="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500">
      </a>
      
      <!-- Details -->
      <div class="p-6 space-y-3">
        <div class="flex items-center justify-between text-[11px] font-semibold text-slate-400 font-sans">
          <span class="px-2.5 py-0.5 bg-brand-50 text-brand-600 rounded-full">${blog.category}</span>
          <span>${blog.date}</span>
        </div>
        <a href="${prefix}blog/${blog.id}" class="block">
          <h3 class="text-base font-bold text-slate-800 hover:text-brand-500 transition-colors leading-snug font-serif">${blog.title}</h3>
        </a>
        <p class="text-xs text-slate-500 leading-relaxed font-sans line-clamp-3">${blog.excerpt}</p>
      </div>
    </div>
    
    <div class="px-6 pb-6 pt-2">
      <a href="${prefix}blog/${blog.id}" class="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-500 transition-all group-hover:translate-x-0.5 duration-300">
        আরও পড়ুন 
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </a>
    </div>
  </div>
  `;
}

// ----------------------------------------------------
// BUILD HOMEPAGE (index.html)
// ----------------------------------------------------
console.log('Generating index.html...');
let categoriesGridHTML = '';
siteData.categories.forEach(cat => {
  categoriesGridHTML += `
  <a href="category/${cat.id}" class="relative group h-64 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-brand-100 block">
    <img src="${cat.image}" alt="${cat.name}" loading="lazy" width="300" height="200" class="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500">
    <div class="absolute inset-0 bg-gradient-to-t from-brand-950/80 via-brand-950/20 to-transparent"></div>
    <div class="absolute bottom-5 left-5 right-5">
      <span class="text-[10px] font-bold text-accent-yellow uppercase tracking-wider font-sans">কালেকশন</span>
      <h3 class="text-lg font-bold text-white mt-0.5 font-serif">${cat.name}</h3>
      <p class="text-xs text-brand-200/80 mt-1 leading-relaxed font-sans">${cat.description}</p>
    </div>
  </a>
  `;
});

let bestSellersGridHTML = '';
let bestSellers = siteData.products.filter(p => p.isBestSeller).slice(0, 6);
bestSellers.forEach((prod, index) => {
  bestSellersGridHTML += renderProductCard(prod, '', index);
});

let testimonialsGridHTML = '';
siteData.testimonials.forEach(test => {
  testimonialsGridHTML += `
  <div class="bg-white p-6 rounded-2xl border border-brand-100 shadow-xs space-y-4">
    <div class="flex items-center gap-1 text-amber-400 text-sm">
      ${generateStarsHTML(test.rating)}
    </div>
    <p class="text-sm text-slate-600 leading-relaxed italic font-sans">"${test.text}"</p>
    <div class="flex items-center gap-3 pt-2">
      <div class="w-8 h-8 rounded-full bg-brand-50 text-brand-600 font-bold flex items-center justify-center text-xs">
        ${test.name.charAt(0)}
      </div>
      <div>
        <h4 class="text-xs font-bold text-slate-800">${test.name}</h4>
        <p class="text-[10px] text-slate-400">${test.designation} • ${test.date}</p>
      </div>
    </div>
  </div>
  `;
});

let indexContent = indexTemplate
  .replace(/\{\{CATEGORIES_GRID\}\}/g, categoriesGridHTML)
  .replace(/\{\{PRODUCTS_GRID\}\}/g, bestSellersGridHTML)
  .replace(/\{\{TESTIMONIALS_GRID\}\}/g, testimonialsGridHTML);

const compiledHomepage = compilePage(indexContent, 'খাঁটি ও সুস্বাদু খাবারের ঠিকানা', 'চাঁপাইনবাবগঞ্জের খাঁটি ও অর্গানিক আম, ঐতিহ্যবাহী মিষ্টি, আচার এবং শুকনো খাবার কিনুন।', '', 'home', '<link rel="preload" as="image" href="images/hero-bg.jpg" fetchpriority="high">');

fs.writeFileSync(
  path.join(__dirname, 'index.html'), 
  compiledHomepage
);

fs.writeFileSync(
  path.join(__dirname, 'home.html'), 
  compiledHomepage
);

// ----------------------------------------------------
// BUILD SHOP PAGE (shop.html)
// ----------------------------------------------------
console.log('Generating shop.html...');
let categoriesFilterListHTML = '';
siteData.categories.forEach(cat => {
  categoriesFilterListHTML += `
  <button @click="setCategory('${cat.id}')" 
          :class="activeCategory === '${cat.id}' ? 'bg-brand-500 text-white font-semibold' : 'text-slate-600 hover:bg-brand-50'" 
          class="w-full text-left text-sm px-3 py-2 rounded-lg transition-all flex justify-between items-center cursor-pointer">
    <span>${cat.name}</span>
  </button>
  `;
});

let shopProductsHTML = '';
siteData.products.forEach((prod, index) => {
  shopProductsHTML += renderProductCard(prod, '', index);
});

let shopContent = shopTemplate
  .replace(/\{\{CATEGORIES_FILTER_LIST\}\}/g, categoriesFilterListHTML)
  .replace(/\{\{SHOP_PRODUCTS_LIST\}\}/g, shopProductsHTML);

fs.writeFileSync(
  path.join(__dirname, 'shop.html'),
  compilePage(shopContent, 'সব পণ্য', 'আমাদের সকল অর্গানিক আম, মিষ্টি এবং আচারের তালিকা দেখুন।', '', 'shop')
);

// ----------------------------------------------------
// BUILD CATEGORY PAGES (category/[id].html)
// ----------------------------------------------------
console.log('Generating category pages...');
siteData.categories.forEach(cat => {
  const catProducts = siteData.products.filter(p => p.category === cat.id);
  
  let catProductsHTML = '';
  catProducts.forEach((prod, index) => {
    catProductsHTML += renderProductCard(prod, '../', index);
  });

  let catContent = categoryTemplate
    .replace(/\{\{CATEGORY_NAME\}\}/g, cat.name)
    .replace(/\{\{CATEGORY_DESCRIPTION\}\}/g, cat.description)
    .replace(/\{\{CATEGORY_PRODUCTS\}\}/g, catProductsHTML)
    .replace(/\{\{CATEGORY_EMPTY\}\}/g, catProducts.length === 0 ? 'true' : 'false');

  fs.writeFileSync(
    path.join(__dirname, 'category', `${cat.id}.html`),
    compilePage(catContent, cat.name, cat.description, '../')
  );
});

// ----------------------------------------------------
// BUILD PRODUCT DETAILS PAGES (product/[id].html)
// ----------------------------------------------------
console.log('Generating product detail pages...');
siteData.products.forEach(prod => {
  const cat = siteData.categories.find(c => c.id === prod.category) || { name: 'Products', id: 'all' };
  
  // Badges
  let badgesHTML = '';
  if (prod.isNew) badgesHTML += `<span class="px-2.5 py-1 text-[10px] font-bold bg-brand-500 text-white rounded-full uppercase tracking-wider">নতুন</span>`;
  if (prod.isBestSeller) badgesHTML += `<span class="px-2.5 py-1 text-[10px] font-bold bg-accent-orange text-white rounded-full uppercase tracking-wider">বেস্ট সেলার</span>`;

  // Filter reviews for this product
  const productReviews = (siteData.reviews || []).filter(r => r.productId === prod.id);
  const reviewsCount = productReviews.length;
  let rating = 5;
  if (productReviews.length > 0) {
    const totalRating = productReviews.reduce((sum, r) => sum + Number(r.rating), 0);
    rating = Number((totalRating / productReviews.length).toFixed(1));
  }

  // Related products
  let relatedProducts = siteData.products.filter(p => p.category === prod.category && p.id !== prod.id).slice(0, 4);
  let relatedHTML = '';
  relatedProducts.forEach((related, idx) => {
    relatedHTML += renderProductCard(related, '../', idx);
  });
  if (!relatedHTML) {
    relatedHTML = `<p class="col-span-full text-sm text-slate-400 italic font-sans">কোনো সম্পর্কিত পণ্য পাওয়া যায়নি।</p>`;
  }

  // Generate dynamic JSON-LD Product & Review schema
  const schemaObj = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": prod.name,
    "image": (prod.images || [prod.image]).map(img => `https://chapaifresh.com/${img}`),
    "description": prod.shortDescription || prod.description,
    "sku": prod.id,
    "offers": {
      "@type": "Offer",
      "url": `https://chapaifresh.com/product/${prod.id}`,
      "priceCurrency": "BDT",
      "price": prod.price,
      "priceValidUntil": "2027-12-31",
      "itemCondition": "https://schema.org/NewCondition",
      "availability": prod.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    }
  };

  if (reviewsCount > 0) {
    schemaObj.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": rating,
      "reviewCount": reviewsCount,
      "bestRating": "5",
      "worstRating": "1"
    };
    schemaObj.review = productReviews.map(r => ({
      "@type": "Review",
      "author": {
        "@type": "Person",
        "name": r.name
      },
      "datePublished": r.date,
      "reviewBody": r.text,
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": r.rating,
        "bestRating": "5",
        "worstRating": "1"
      }
    }));
  }
  
  const productSchemaJSON = `<script type="application/ld+json">\n${JSON.stringify(schemaObj, null, 2)}\n</script>`;

  let prodContent = productTemplate
    .replace(/\{\{PRODUCT_ID\}\}/g, prod.id)
    .replace(/\{\{PRODUCT_NAME\}\}/g, prod.name)
    .replace(/\{\{PRODUCT_CATEGORY_ID\}\}/g, cat.id)
    .replace(/\{\{PRODUCT_CATEGORY_NAME\}\}/g, cat.name)
    .replace(/\{\{PRODUCT_IMAGE\}\}/g, prod.image)
    .replace(/\{\{PRODUCT_IMAGES_LIST_JSON\}\}/g, JSON.stringify(prod.images || [prod.image]).replace(/'/g, "\\'").replace(/"/g, "'"))
    .replace(/\{\{PRODUCT_SCHEMA_JSON\}\}/g, productSchemaJSON)
    .replace(/\{\{PRODUCT_PRICE\}\}/g, prod.price)
    .replace(/\{\{PRODUCT_ORIGINAL_PRICE\}\}/g, prod.originalPrice)
    .replace(/\{\{PRODUCT_UNIT\}\}/g, prod.unit)
    .replace(/\{\{PRODUCT_DESCRIPTION\}\}/g, prod.description)
    .replace(/\{\{PRODUCT_SHORT_DESCRIPTION\}\}/g, prod.shortDescription || prod.description)
    .replace(/\{\{PRODUCT_REVIEWS_COUNT\}\}/g, reviewsCount)
    .replace(/\{\{PRODUCT_STARS\}\}/g, generateStarsHTML(rating))
    .replace(/\{\{PRODUCT_RATING_RAW\}\}/g, rating)
    .replace(/\{\{PRODUCT_REVIEWS_JSON\}\}/g, JSON.stringify(productReviews).replace(/'/g, "\\'"))
    .replace(/\{\{PRODUCT_BADGES\}\}/g, badgesHTML)
    .replace(/\{\{PRODUCT_IN_STOCK\}\}/g, prod.inStock ? 'true' : 'false')
    .replace(/\{\{STOCK_STATUS_TEXT\}\}/g, prod.inStock ? 'স্টকে আছে' : 'স্টক শেষ')
    .replace(/\{\{STOCK_STATUS_COLOR\}\}/g, prod.inStock ? 'text-emerald-500' : 'text-rose-500')
    .replace(/\{\{RELATED_PRODUCTS\}\}/g, relatedHTML);

  const cleanMetaDesc = prod.description.replace(/[\r\n]+/g, ' ').replace(/"/g, '&quot;').substring(0, 150) + '...';

  fs.writeFileSync(
    path.join(__dirname, 'product', `${prod.id}.html`),
    compilePage(prodContent, prod.name, cleanMetaDesc, '../', '', `<link rel="preload" as="image" href="../${prod.image}" fetchpriority="high">`)
  );
});

// Clean up stale product pages in the product/ directory
try {
  const productFiles = fs.readdirSync(path.join(__dirname, 'product'));
  const activeProductFiles = new Set(siteData.products.map(p => `${p.id}.html`));
  productFiles.forEach(file => {
    if (file.endsWith('.html') && !activeProductFiles.has(file)) {
      try {
        fs.unlinkSync(path.join(__dirname, 'product', file));
        console.log(`Deleted stale product page: product/${file}`);
      } catch (err) {
        console.error(`Error deleting stale product page product/${file}:`, err.message);
      }
    }
  });
} catch (err) {
  console.error('Error cleaning up product directory:', err.message);
}

// ----------------------------------------------------
// BUILD STATIC PAGES (about.html, contact.html)
// ----------------------------------------------------
console.log('Generating about.html and contact.html...');
fs.writeFileSync(
  path.join(__dirname, 'about.html'),
  compilePage(aboutTemplate, 'আমাদের সম্পর্কে', 'আমাদের শিকড়, কৃষক এবং গুণগত মানের মানদণ্ড সম্পর্কে জানুন।', '', 'about')
);
fs.writeFileSync(
  path.join(__dirname, 'contact.html'),
  compilePage(contactTemplate, 'যোগাযোগ', 'পাইকারি অর্ডার বা যেকোনো জিজ্ঞাসার জন্য আমাদের সাথে যোগাযোগ করুন।', '', 'contact')
);
fs.writeFileSync(
  path.join(__dirname, '404.html'),
  compilePage(error404Template, '৪০৪ - পেজটি পাওয়া যায়নি', 'দুঃখিত, পেজটি খুঁজে পাওয়া যায়নি!', '/', '')
);

// ----------------------------------------------------
// BUILD BLOG PAGES (blog.html & blog/[id].html)
// ----------------------------------------------------
console.log('Generating blog.html and blog detail pages...');
let blogsGridHTML = '';
(siteData.blogs || []).forEach(blog => {
  blogsGridHTML += renderBlogCard(blog, '');
});

let blogContent = blogTemplate
  .replace(/\{\{BLOGS_GRID\}\}/g, blogsGridHTML);

fs.writeFileSync(
  path.join(__dirname, 'blog.html'),
  compilePage(blogContent, 'ব্লগ', 'চাঁপাইনবাবগঞ্জের আমের খবর, মিষ্টির ঐতিহ্য এবং সুস্বাদু রেসিপি নিয়ে প্রবন্ধসমূহ।', '', 'blog')
);

(siteData.blogs || []).forEach(blog => {
  // Generate related blogs (excluding current)
  let relatedBlogs = (siteData.blogs || []).filter(b => b.id !== blog.id).slice(0, 3);
  let relatedBlogsHTML = '';
  relatedBlogs.forEach(rel => {
    relatedBlogsHTML += renderBlogCard(rel, '../');
  });
  if (!relatedBlogsHTML) {
    relatedBlogsHTML = `<p class="col-span-full text-sm text-slate-400 italic font-sans">কোনো সম্পর্কিত ব্লগ পাওয়া যায়নি।</p>`;
  }

  let blogDetailContent = blogDetailTemplate
    .replace(/\{\{BLOG_TITLE\}\}/g, blog.title)
    .replace(/\{\{BLOG_CATEGORY\}\}/g, blog.category)
    .replace(/\{\{BLOG_AUTHOR\}\}/g, blog.author)
    .replace(/\{\{BLOG_DATE\}\}/g, blog.date)
    .replace(/\{\{BLOG_READ_TIME\}\}/g, blog.readTime)
    .replace(/\{\{BLOG_IMAGE\}\}/g, blog.image)
    .replace(/\{\{BLOG_CONTENT\}\}/g, blog.content)
    .replace(/\{\{RELATED_BLOGS\}\}/g, relatedBlogsHTML);

  const cleanMetaDesc = (blog.excerpt || blog.content).replace(/[\r\n]+/g, ' ').replace(/"/g, '&quot;').substring(0, 150) + '...';

  fs.writeFileSync(
    path.join(__dirname, 'blog', `${blog.id}.html`),
    compilePage(blogDetailContent, blog.title, cleanMetaDesc, '../', 'blog', `<link rel="preload" as="image" href="../${blog.image}" fetchpriority="high">`)
  );
});

// ----------------------------------------------------
// COMPILE TAILWIND CSS
// ----------------------------------------------------
try {
  console.log('Compiling Tailwind CSS...');
  execSync('npx tailwindcss -i ./input.css -o ./output.css --minify', { stdio: 'inherit' });
  console.log('Tailwind compilation completed successfully.');
} catch (error) {
  console.error('Error compiling Tailwind CSS via npx:', error.message);
  console.log('Ensure tailwindcss CLI is working. Make sure npm dependencies are properly configured.');
}

console.log('🎉 Website built successfully!');
