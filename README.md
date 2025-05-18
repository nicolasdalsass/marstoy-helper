# Marstoy BrickLink Set Finder

This Firefox extension enhances Marstoy.net by adding BrickLink set names to product codes that match the pattern "M" followed by 5 digits.

## Features

- Automatically detects product codes in the format M##### on marstoy.net
- Fetches corresponding set names from BrickLink using the reversed digits
- Appends the set name next to the product code

## Installation

1. Open Firefox and navigate to `about:debugging`
2. Click on "This Firefox" in the left sidebar
3. Click on "Load Temporary Add-on"
4. Navigate to the extension folder and select the `manifest.json` file

## Usage

1. Visit any page on marstoy.net
2. The extension will automatically scan the page for product codes
3. When it finds a code (e.g., "M12345"), it will fetch the corresponding set name from BrickLink (using "54321")
4. The set name will be appended next to the product code

## Notes

- The extension needs permission to access both marstoy.net and bricklink.com
- Internet connection is required for the BrickLink lookups to work
- Some set numbers might not have corresponding entries on BrickLink 