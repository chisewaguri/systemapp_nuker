# Contributing to System App Nuker

## Contributing to app categories

Thanks for helping keep the app list accurate and up-to-date! This guide explains how to add or update app entries

### Understanding the Format

Apps are listed as package names mapped to category ids. Example:

"com.android.settings": "essential"

- The key is the app’s package name (unique Android identifier)
- The value is the category id (template key) defined in the categories section

Make sure the category id you assign an app to already exists.

### How to Add or Update Apps

1. Find the correct category for the app (e.g., essential, caution, safe, google, unknown)
2. Add or update the app’s package name under the appropriate comment section for clarity.
3. Follow the existing JSON formatting with commas and quotes
4. Avoid duplicates by searching the file before adding a new entry
5. Provide relevant and accurate category assignments based on app function

Example Addition:

"com.example.newapp": "safe"

Place this in the appropriate section with a comment if needed.

### General Tips

- Validate your JSON changes with a linter or online validator before submitting
- Keep entries organized under corresponding comment headers
- Use meaningful and accurate category mappings to minimize accidental removals or breakage
- Provide a clear summary of your additions in the pull request description


## Code Contributions
We welcome code contributions to improve System App Nuker!

### Guidelines for Code Contributions
- Use clear variable names
- Comment your code, especially for complex operations
- Format your code consistently
- Follow the existing style patterns

## How to Submit Changes

1. Fork the repository.
2. Create a new branch for your app list updates.
3. Edit webroot/categories.json with your changes.
4. Check JSON validity.
5. Submit a pull request describing your additions.

## Reporting Issues
When reporting issues, please include:
- Your device model
- Android version
- Root solution and version
- Steps to reproduce the issue
- Any relevant error messages

Thank you for helping improve System App Nuker!
