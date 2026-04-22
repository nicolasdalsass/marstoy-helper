console.log("Marstoy extension loaded");

const setNameCache = new Map();

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
    link.rel = 'noopener noreferrer';
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

function normalizeUrlForComparison(url) {
    try {
        const parsed = new URL(url, window.location.href);
        return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
    } catch (error) {
        return url || '';
    }
}

function isProductLink(url) {
    try {
        const parsed = new URL(url, window.location.href);
        return parsed.pathname.includes('/products/');
    } catch (error) {
        return false;
    }
}

function looksLikeProductImage(img) {
    if (!(img instanceof HTMLImageElement)) return false;

    const src = (img.currentSrc || img.src || '').toLowerCase();
    const alt = (img.alt || '').toLowerCase();
    const combined = `${src} ${alt}`;

    if (!src) return false;
    if (combined.includes('.svg')) return false;
    if (combined.includes('.gif')) return false;
    if (/(logo|icon|loading|loader|chat|package-opening|cube-shape|grid-square)/.test(combined)) return false;
    if (img.closest('header, nav, footer, [role="dialog"]')) return false;

    const width = img.clientWidth || img.width || Number.parseInt(img.getAttribute('width') || '0', 10);
    const height = img.clientHeight || img.height || Number.parseInt(img.getAttribute('height') || '0', 10);

    if ((width && width < 80) || (height && height < 80)) return false;

    return true;
}

function getProductLinks(container) {
    return Array.from(container.querySelectorAll('a[href]')).filter(link => isProductLink(link.href));
}

function scoreProductContainer(container, titleElement, productCode) {
    const text = container.textContent || '';
    const productLinks = getProductLinks(container);
    const productImages = Array.from(container.querySelectorAll('img')).filter(looksLikeProductImage);
    const uniqueProductLinks = new Set(productLinks.map(link => normalizeUrlForComparison(link.href)));
    const codeRegex = new RegExp(`\\b${productCode}\\b`, 'i');
    let score = 0;

    if (!container.contains(titleElement)) return Number.NEGATIVE_INFINITY;
    if (!productImages.length && !/\b(add to cart|buy now|shipping estimated|product details)\b/i.test(text)) {
        return Number.NEGATIVE_INFINITY;
    }

    score += 5;
    if (productImages.length) score += 15;
    if (productImages.some(img => img.compareDocumentPosition(titleElement) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        score += 10;
    }
    if (/\b(add to cart|buy now)\b/i.test(text)) score += 30;
    if (/\b(shipping estimated|product details)\b/i.test(text)) score += 15;
    if (productLinks.length) score += 10;
    if (uniqueProductLinks.size === 1) score += 20;
    else if (uniqueProductLinks.size <= 3) score += 10;
    if (uniqueProductLinks.size > 12) score -= 40;
    if (productImages.length > 8) score -= 20;
    if (codeRegex.test(text)) score += 10;
    if (container === document.body) score -= 100;

    return score;
}

function findProductContainer(textNode, productCode) {
    const titleElement = textNode.parentElement;
    let current = titleElement;
    let bestContainer = titleElement;
    let bestScore = Number.NEGATIVE_INFINITY;

    while (current && current !== document.body) {
        const score = scoreProductContainer(current, titleElement, productCode);
        if (score > bestScore) {
            bestScore = score;
            bestContainer = current;
        }
        current = current.parentElement;
    }

    return bestContainer;
}

function dedupeElements(elements) {
    return Array.from(new Set(elements));
}

function findProductImages(container, titleElement, productCode) {
    const titleAnchor = titleElement.closest('a[href]');
    const codeRegex = new RegExp(`\\b${productCode}\\b`, 'i');
    const allImages = Array.from(container.querySelectorAll('img')).filter(looksLikeProductImage);

    if (!allImages.length) return [];

    let productUrl = null;
    if (titleAnchor && isProductLink(titleAnchor.href)) {
        productUrl = normalizeUrlForComparison(titleAnchor.href);
    } else {
        const matchingAnchor = getProductLinks(container).find(link => codeRegex.test(link.textContent || ''));
        if (matchingAnchor) {
            productUrl = normalizeUrlForComparison(matchingAnchor.href);
        }
    }

    let candidates = [];

    if (productUrl) {
        candidates = allImages.filter(img => {
            const parentLink = img.closest('a[href]');
            return parentLink && normalizeUrlForComparison(parentLink.href) === productUrl;
        });
    }

    if (!candidates.length) {
        candidates = allImages.filter(img => img.compareDocumentPosition(titleElement) & Node.DOCUMENT_POSITION_FOLLOWING);
    }

    if (!candidates.length) {
        candidates = allImages;
    }

    return dedupeElements(candidates).slice(0, 6);
}

function findLinkInsertionTarget(textNode, productCode) {
    const titleElement = textNode.parentElement;
    const codeRegex = new RegExp(`\\b${productCode}\\b`, 'i');
    const titleAnchor = titleElement?.closest('a[href]');

    if (titleAnchor && isProductLink(titleAnchor.href) && codeRegex.test(titleAnchor.textContent || '')) {
        return {
            mode: 'after',
            element: titleAnchor
        };
    }

    const inlineHost = titleElement?.closest('h1, h2, h3, h4, h5, h6, p, span, div, li');
    if (inlineHost && inlineHost.textContent && inlineHost.textContent.trim().length < 160) {
        return {
            mode: 'append',
            element: inlineHost
        };
    }

    return null;
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
    if (!setNameCache.has(setNumber)) {
        const promise = (async () => {
            try {
                const response = await fetch(`https://www.bricklink.com/v2/catalog/catalogitem.page?S=${setNumber}`, {
                    redirect: 'follow'
                });
                const html = await response.text();

                const titlePatterns = [
                    /catalogitem\.page\?S=\d+-1"[^>]*>([^<]+)<\/a>/,
                    /<title>([^<]+) \| BrickLink/,
                    /<h1[^>]*>([^<]+)<\/h1>/
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
        })();

        setNameCache.set(setNumber, promise);
    }

    return setNameCache.get(setNumber);
}

// --- Main Enrichment Function ---
async function enrichTextNode(textNode) {
    if (hasBrickLinkEnrichedAncestor(textNode)) return;

    const text = textNode.textContent.trim();
    if (!text) return;

    const regex = /[MN](\d{4,6})/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const productCode = match[0];
        const digits = match[1];
        const reversedDigits = reverseString(digits);
        const setName = await fetchSetName(reversedDigits);
        if (!setName) continue;
        
        const brickLinkImageUrl = `https://img.bricklink.com/ItemImage/SN/0/${reversedDigits}-1.png`;

        const titleElement = textNode.parentElement;
        const container = findProductContainer(textNode, productCode);
        const productImages = findProductImages(container, titleElement, productCode);

        for (const img of productImages) {
            img.style.opacity = '1';
            img.style.visibility = 'visible';
            img.style.display = 'block';

            img.removeAttribute('srcset');
            img.removeAttribute('data-srcset');
            img.removeAttribute('data-sizes');
            img.removeAttribute('sizes');
            img.removeAttribute('data-src');
            img.classList.remove('lazyautosizes', 'ls-is-cached', 'lazyloaded');

            img.src = brickLinkImageUrl;
            img.alt = setName;
            img.loading = 'eager';

            img.style.maxWidth = '100%';
            img.style.height = 'auto';

            img.onload = function () {
                img.style.opacity = '1';
                img.style.visibility = 'visible';
                img.style.display = 'block';
            };
            img.onerror = function () {
                img.style.display = "none";
            };
        }

        const insertionTarget = findLinkInsertionTarget(textNode, productCode);
        const existingSelector = `a[href*="bricklink.com"][href*="catalogitem.page?S=${reversedDigits}"]`;

        if (insertionTarget?.mode === 'after') {
            const hostParent = insertionTarget.element.parentElement;
            if (hostParent && !hostParent.querySelector(existingSelector)) {
                const linkOnly = createBrickLinkLink(reversedDigits, setName);
                linkOnly.style.marginLeft = '8px';
                insertionTarget.element.insertAdjacentElement('afterend', linkOnly);
                hostParent.classList.add('bricklink-enriched');
            }
        } else if (insertionTarget?.mode === 'append') {
            if (!insertionTarget.element.querySelector(existingSelector)) {
                const linkOnly = createBrickLinkLink(reversedDigits, setName);
                linkOnly.style.marginLeft = '8px';
                insertionTarget.element.appendChild(linkOnly);
                insertionTarget.element.classList.add('bricklink-enriched');
            }
        } else {
            const wrapper = document.createElement('span');
            wrapper.className = 'bricklink-enriched';
            wrapper.style.display = 'inline-block';
            wrapper.appendChild(document.createTextNode(text));
            wrapper.appendChild(createBrickLinkLink(reversedDigits, setName));
            textNode.replaceWith(wrapper);
        }

        break; // Only one match per node
    }
}

// Page processing
async function processPage() {
    
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
setTimeout(() => {
    init();
}, 1000);
