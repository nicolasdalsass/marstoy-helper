console.log("Marstoy extension loaded");

// Utility functions
function reverseString(str) {
    return str.split('').reverse().join('');
}

function decodeHtmlEntities(text) {
    const parser = new DOMParser();
    const dom = parser.parseFromString(
        '<!doctype html><body>' + text, 'text/html');
    return dom.body.textContent;

}

function createBrickLinkLink(setNumber, setName) {
    const link = document.createElement('a');
    link.href = `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${setNumber}`;
    link.textContent = `(${setName})`;
    link.target = '_blank';
    link.style.marginLeft = '5px';
    link.style.color = '#0066cc';
    link.style.textDecoration = 'none';
    link.style.padding = '4px 8px';
    link.style.minHeight = '44px';
    link.style.display = 'inline-block';
    link.style.verticalAlign = 'middle';
    link.addEventListener('mouseover', () => link.style.textDecoration = 'underline');
    link.addEventListener('mouseout', () => link.style.textDecoration = 'none');
    return link;
}

// Check if any ancestor has the bricklink-enriched class
function hasBrickLinkEnrichedAncestor(node) {
    let current = node.parentElement;
    while (current) {
        if (current.classList && current.classList.contains('bricklink-enriched')) return true;
        current = current.parentElement;
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
                return decodeHtmlEntities(match[1].trim());
            }
        }

        return null;
    } catch (error) {
        console.error('Error fetching set name:', error);
        return null;
    }
}

// --- Main Enrichment Function ---
async function enrichTextNode(textNode) {
    if (hasBrickLinkEnrichedAncestor(textNode)) return;

    const text = textNode.textContent.trim();
    if (!text) return;

    const regex = /[MN](\d{4,5})/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const digits = match[1];
        const reversedDigits = reverseString(digits);

        const setName = await fetchSetName(reversedDigits);
        if (!setName) continue;
        
        const brickLinkImageUrl = `https://img.bricklink.com/ItemImage/SN/0/${reversedDigits}-1.png`;

        // Image DOM update logic
        let container = textNode.parentElement;
        while (container && !container.classList?.contains('club-product-snippet') && !container.classList?.contains('product-snippet') && !container.classList?.contains('p-cursor-pointer')) {
            container = container.parentElement;
        }
        if (container) {
            const imageContainer = container.querySelector('.product-snippet-image-container, .product-snippet__img-wrapper, .p-relative');
            if (imageContainer) {
                const mainImg = imageContainer.querySelector('img');
                if (mainImg) {
                    // Set initial style to ensure visibility
                    mainImg.style.opacity = '1';
                    mainImg.style.visibility = 'visible';
                    mainImg.style.display = 'block';
                    
                    // Remove all lazy loading related attributes and classes
                    mainImg.removeAttribute('srcset');
                    mainImg.removeAttribute('data-srcset');
                    mainImg.removeAttribute('data-sizes');
                    mainImg.removeAttribute('sizes');
                    mainImg.removeAttribute('data-src');
                    mainImg.classList.remove('lazyautosizes', 'ls-is-cached', 'lazyloaded');
                    
                    // Set the image directly from BrickLink
                    mainImg.src = brickLinkImageUrl;
                    mainImg.alt = setName;
                    
                    // Make image responsive
                    mainImg.style.maxWidth = '100%';
                    mainImg.style.height = 'auto';
                    
                    // Handle image loading
                    mainImg.onload = function () {
                        console.log(`[BrickLink] Image loaded for set ${reversedDigits}`);
                        mainImg.style.opacity = '1';
                        mainImg.style.visibility = 'visible';
                        mainImg.style.display = 'block';
                    };
                    mainImg.onerror = function () {
                        console.warn(`[BrickLink] Image failed to load for set ${reversedDigits}`);
                        mainImg.style.display = "none";
                    };
                }
            }
        }

        // Title + link enrichment logic
        const wrapper = document.createElement('span');
        wrapper.className = 'bricklink-enriched';
        wrapper.style.display = 'inline-block';
        wrapper.appendChild(document.createTextNode(text));
        wrapper.appendChild(createBrickLinkLink(reversedDigits, setName));

        textNode.replaceWith(wrapper);

        break; // Only one match per node
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