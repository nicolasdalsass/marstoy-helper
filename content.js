console.log("Marstoy extension loaded");

// Keep track of processed elements
const processedElements = new Set();

// Utility functions
function reverseString(str) {
    return str.split('').reverse().join('');
}

function createBrickLinkLink(setNumber, setName) {
    const link = document.createElement('a');
    link.href = `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${setNumber}`;
    link.textContent = `(${setName})`;
    link.target = '_blank';
    link.style.marginLeft = '5px';
    link.style.color = '#0066cc';
    link.style.textDecoration = 'none';
    link.addEventListener('mouseover', () => link.style.textDecoration = 'underline');
    link.addEventListener('mouseout', () => link.style.textDecoration = 'none');
    return link;
}

// Check if an element or its parent already has enrichment
function hasExistingEnrichment(element) {
    // Check the element itself
    if (!element) return false;

    // Check for existing BrickLink links
    if (element.querySelector('a[href*="bricklink.com"]')) {
        console.log('Found existing BrickLink link');
        return true;
    }

    // Check for our known enrichment patterns
    const enrichmentPatterns = [
        'bricklink.com',
        /\([^)]+\)(?:\s*\([^)]+\))?$/,  // One or two parentheses blocks at end
        '(fail to enrich)'
    ];

    // Check element's text content
    const content = element.textContent || '';
    for (const pattern of enrichmentPatterns) {
        if (typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content)) {
            console.log('Found existing enrichment pattern:', pattern);
            return true;
        }
    }

    return false;
}

// BrickLink API functions
async function fetchSetName(setNumber) {
    try {
        const response = await fetch(`https://www.bricklink.com/v2/catalog/catalogitem.page?S=${setNumber}`, {
            redirect: 'follow'
        });
        const html = await response.text();
        
        // Try different patterns to find the title
        const titlePatterns = [
            /catalogitem\.page\?S=\d+-1"[^>]*>([^<]+)<\/a>/,  // Breadcrumb
            /<title>([^<]+) \| BrickLink/,                     // Page title
            /<h1[^>]*>([^<]+)<\/h1>/                          // Any h1 tag
        ];

        for (const pattern of titlePatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return null;
    } catch (error) {
        console.error('Error fetching set name:', error);
        return null;
    }
}

// Core enrichment function
async function enrichTextNode(textNode) {
    console.log('Attempting to enrich text node:', textNode.textContent.trim());

    // Skip if already processed
    if (processedElements.has(textNode)) {
        console.log('Skipping already processed node');
        return;
    }

    // Skip if parent is already processed or has enrichment
    if (textNode.parentElement) {
        if (processedElements.has(textNode.parentElement)) {
            console.log('Skipping due to processed parent');
            return;
        }
        if (hasExistingEnrichment(textNode.parentElement)) {
            console.log('Skipping due to existing enrichment in parent');
            return;
        }
    }

    const text = textNode.textContent.trim();
    if (!text) {
        console.log('Skipping empty text node');
        return;
    }

    const regex = /[MN](\d{4,5})/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        console.log('Found pattern match:', match[0]);
        const digits = match[1];
        const reversedDigits = reverseString(digits);
        
        const setName = await fetchSetName(reversedDigits);
        console.log('Fetched set name:', setName);
        
        if (setName) {
            // Create enriched content
            const wrapper = document.createElement('span');
            wrapper.className = 'bricklink-enriched';
            wrapper.appendChild(document.createTextNode(text));
            wrapper.appendChild(createBrickLinkLink(reversedDigits, setName));
            
            // Replace and mark as processed
            textNode.replaceWith(wrapper);
            processedElements.add(wrapper);
            processedElements.add(textNode);
            console.log('Successfully enriched text node');
            break;
        }
    }
}

// Page processing
async function processPage() {
    console.log("Beginning to process page");
    
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // Skip script, style tags and empty nodes
                if (node.parentElement && 
                    (node.parentElement.tagName === 'SCRIPT' || 
                     node.parentElement.tagName === 'STYLE' ||
                     node.parentElement.tagName === 'NOSCRIPT')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const nodes = [];
    let node;
    while (node = walker.nextNode()) {
        if (node.textContent.trim()) {
            nodes.push(node);
        }
    }

    console.log(`Found ${nodes.length} text nodes to process`);
    for (const node of nodes) {
        await enrichTextNode(node);
    }
}

// Mutation Observer setup
const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(async node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    if (node.textContent.trim()) {
                        await enrichTextNode(node);
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    // Process text nodes in the new element
                    const walker = document.createTreeWalker(
                        node,
                        NodeFilter.SHOW_TEXT,
                        null
                    );

                    while (walker.nextNode()) {
                        const textNode = walker.currentNode;
                        if (textNode.textContent.trim()) {
                            await enrichTextNode(textNode);
                        }
                    }
                }
            });
        }
    });
});

// Initialize
function init() {
    processPage();
    observer.observe(document.body, { childList: true, subtree: true });
}

// Make sure we run on both initial load and after any dynamic content loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Also try after a short delay to catch any dynamic content
setTimeout(init, 1000); 