# Contributing to System App Nuker

## Adding App Categories

The categorization system in System App Nuker helps users make better decisions about which apps are safe to remove.

### How to Contribute App Categories

1. Fork this repository
2. Edit `module/webroot/categories.json`
3. Add your app entries to the "apps" section with the appropriate category ID:

"com.example.app": "safe",
"com.example.critical": "essential"

4. Submit a Pull Request

### Available Categories

- **essential**: Critical system components
- **caution**: Use with caution
- **safe**: Safe to remove
- **google**: Google apps and services

## Contributing Code

We welcome code contributions to improve System App Nuker!

### Guidelines for Code Contributions

- Use clear variable names
- Comment your code, especially for complex operations
- Format your code consistently
- Follow the existing style patterns

## Reporting Issues

When reporting issues, please include:
- Your device model
- Android version
- Root solution and version
- Steps to reproduce the issue
- Any relevant error messages

Thank you for helping improve System App Nuker!
