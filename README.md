# Marstoy BrickLink Set Finder

This Firefox extension enhances Marstoy.net by adding BrickLink set names to product codes that match the pattern "M" followed by 5 digits, and improves the product images.

## Features

- Automatically detects product codes in the format M##### on marstoy.net
- Fetches corresponding set names from BrickLink using the reversed digits
- Appends the set name next to the product code
- Replaces product images with high-quality BrickLink images
- Implements intelligent image caching to improve performance
- Optimizes image quality through advanced downscaling algorithms
- Removes lazy loading attributes for immediate image display

## Installation

### Temporary Installation (Development/Testing)
1. Open Firefox and navigate to `about:debugging`
2. Click on "This Firefox" in the left sidebar
3. Click on "Load Temporary Add-on"
4. Navigate to the extension folder and select the `manifest.json` file

### Permanent Installation (Firefox Add-ons Store)
1. Visit the Firefox Add-ons store (link to be added)
2. Click "Add to Firefox"
3. Confirm the installation

Note: The extension ID is only required for permanent installation through the Firefox Add-ons store. For temporary installation during development, no ID is needed.

## Usage

1. Visit any page on marstoy.net
2. The extension will automatically scan the page for product codes
3. When it finds a code (e.g., "M12345"), it will:
   - Fetch the corresponding set name from BrickLink (using "54321")
   - Replace the product image with a high-quality BrickLink image
   - Cache the image for faster future loading
4. The set name will be appended next to the product code

## Technical Details

- Images are optimized using a multi-step downscaling algorithm for better quality
- Images are cached in both localStorage and sessionStorage for improved performance
- Cache size is automatically managed to prevent storage overflow
- Images are processed with sharpening filters for better clarity
- Lazy loading is disabled to ensure immediate image display

## Notes

- The extension needs permission to access both marstoy.net and bricklink.com
- Internet connection is required for the BrickLink lookups to work
- Some set numbers might not have corresponding entries on BrickLink
- Image caching requires browser storage permissions
- Cache can be cleared using the browser's storage settings 