// Function to call Google Gemini API
async function callGoogleGemini(text, apiKey) {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, { // Using gemini-1.5-flashconst response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, { // Use gemini-pro or gemini-1.5-flash for general use
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Correct the following English text for grammar, spelling, and naturalness. Only provide the corrected text, do not add any explanations or extra conversational text."
              },
              {
                text: text
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7, // Adjust for creativity (lower for more deterministic corrections)
          maxOutputTokens: 500 // Limit the length of the corrected text
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API Error:", errorData);
      throw new Error(errorData.error.message || "Failed to get correction from Gemini API.");
    }

    const data = await response.json();
    // Extract the corrected text from Gemini's response
    // The structure is usually data.candidates[0].content.parts[0].text
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
        return data.candidates[0].content.parts[0].text.trim();
    } else if (data.promptFeedback && data.promptFeedback.blockReason) {
        throw new Error(`Gemini API blocked response: ${data.promptFeedback.blockReason}. This might be due to safety settings or content policy.`);
    } else {
        throw new Error("Unexpected response format from Gemini API.");
    }

  } catch (error) {
    console.error("Error calling Google Gemini API:", error);
    throw error;
  }
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'correctText') {
    callGoogleGemini(request.text, request.apiKey)
      .then(correctedText => {
        sendResponse({ success: true, correctedText: correctedText });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicate that sendResponse will be called asynchronously
  }
});