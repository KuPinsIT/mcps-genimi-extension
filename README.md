# mcps-genimi-extension
Correct english text on input text, using gemini api. Install via chrome and edge extension
Here's the `README.md` file in English for your project:

-----
![image](https://github.com/user-attachments/assets/36208776-e4c5-4070-a01b-35e7d3d78f46)


## Introduction

This is a browser extension designed to help correct spelling and grammar errors in text input fields on specific websites like Azure DevOps and Jira, leveraging the power of Google Gemini AI.

## Key Features

  * Corrects spelling and grammar in `<textarea>` and `div[contenteditable="true"]` elements.
  * Seamlessly integrates with popular platforms like Azure DevOps and Jira.
  * Provides a simple and intuitive user interface.
  * Utilizes Google Gemini API for high-quality correction suggestions.

## Requirements

  * Google Chrome or Microsoft Edge browser.
  * **Google Gemini API Key** (See instructions below).

## Installation Guide

To use this extension, you need to load it as an unpacked extension in your browser.

### 1\. Download the Project

Clone or download this project from GitHub:

```bash
git clone YOUR_REPO_URL
```

Alternatively, download the ZIP file and extract it to a directory.

### 2\. Obtain Your Google Gemini API Key

For the extension to function, you need an API Key from Google Gemini.

1.  Go to Google AI Studio: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2.  Sign in with your Google account.
3.  Click on **"Create API key in new project"** or **"Create API key in existing project"** if you already have one.
      * **Important Note:** Ensure you have accepted the terms of service and enabled the necessary API (typically "Generative Language API" or "Gemini API") in the Google Cloud Console if prompted.
4.  Copy the displayed API Key. **Store it securely; do not share it publicly.**

### 3\. Load the Extension into Your Browser

#### For Google Chrome:

1.  Open Chrome browser.
2.  Type `chrome://extensions` in the address bar and press Enter.
3.  Toggle on **"Developer mode"** in the top right corner.
4.  Click on **"Load unpacked"**.
5.  Select the directory where you downloaded/extracted the project.
6.  The extension should now appear in your list of extensions.

#### For Microsoft Edge:

1.  Open Edge browser.
2.  Type `edge://extensions` in the address bar and press Enter.
3.  Toggle on **"Developer mode"** in the bottom left corner.
4.  Click on **"Load unpacked"**.
5.  Select the directory where you downloaded/extracted the project.
6.  The extension should now appear in your list of extensions.

### 4\. Enter Your Gemini API Key into the Extension

1.  After installing the extension, you will see its icon in your browser's toolbar.
2.  Click on the extension icon.
3.  A popup window will appear.
4.  Paste the **Google Gemini API Key** you obtained in **Step 2** into the input field.
5.  Click the **"Save API Key"** button.

## How to Use

1.  Navigate to a supported website (e.g., Azure DevOps, Jira) that has a text input field (textarea or contenteditable div).
2.  Type your text into the field.
3.  A pencil icon (the "Correct Text" button) should appear in the bottom-right corner of the input field.
4.  Click the pencil icon to send your text to the Google Gemini API for correction.
5.  A popover will display the original text and the suggested corrected text.
6.  Click **"Apply"** to replace the original text with the corrected version, or **"Cancel"** to close the popover.

## Troubleshooting

  * **Button not showing or API error:**
      * Ensure you have correctly entered and saved your API Key.
      * Verify that the Gemini API is enabled in your Google Cloud Console and your API Key has the necessary permissions.
      * Try reloading the extension from `chrome://extensions` or `edge://extensions`.
      * Hard refresh the web page (use `Ctrl + F5` or `Shift + F5`).
      * Open Developer Tools (`F12`) on the web page and check the `Console` and `Network` tabs for error messages.
  * **"Could not establish connection. Receiving end does not exist.":**
      * Ensure you have a `background` section in your `manifest.json` pointing to your `background.js` file.
      * Confirm that your `background.js` file exists and contains the message listener (`chrome.runtime.onMessage.addListener`).
      * After any code changes, always reload the extension and then hard refresh the web page.

## Development

If you wish to contribute or modify the code:

1.  Edit the `.js` and `.css` files within the project directory.
2.  After each change, reload the extension in `chrome://extensions` or `edge://extensions` to apply the updates.
