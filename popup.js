document.addEventListener('DOMContentLoaded', () => {
  const inputText = document.getElementById('inputText');
  const correctButton = document.getElementById('correctButton');
  const correctedText = document.getElementById('correctedText');
  const copyButton = document.getElementById('copyButton'); // Lấy nút Copy
  const copyStatus = document.getElementById('copyStatus'); // Lấy trạng thái copy
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyButton = document.getElementById('saveApiKeyButton');
  const apiKeyStatus = document.getElementById('apiKeyStatus');

  let geminiApiKey = '';

  // Load API Key from storage
  chrome.storage.local.get(['geminiApiKey'], (result) => {
    if (result.geminiApiKey) {
      geminiApiKey = result.geminiApiKey;
      apiKeyStatus.textContent = 'API Key loaded.';
      apiKeyStatus.style.color = 'green';
      apiKeyInput.value = '********'; // Mask the key
    } else {
      apiKeyStatus.textContent = 'Please enter your API Key.';
      apiKeyStatus.style.color = 'red';
    }
  });

  // Save API Key
  saveApiKeyButton.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key && key !== '********') { // Don't save if it's the masked value
      chrome.storage.local.set({ 'geminiApiKey': key }, () => {
        geminiApiKey = key;
        apiKeyStatus.textContent = 'API Key saved successfully!';
        apiKeyStatus.style.color = 'green';
        apiKeyInput.value = '********'; // Mask after saving
      });
    } else if (key === '********') {
        apiKeyStatus.textContent = 'API Key already saved. Nothing changed.';
        apiKeyStatus.style.color = 'orange';
    } else {
        apiKeyStatus.textContent = 'API Key cannot be empty!';
        apiKeyStatus.style.color = 'red';
    }
  });

  // Correct text
  correctButton.addEventListener('click', async () => {
    const textToCorrect = inputText.value.trim();

    if (!textToCorrect) {
      correctedText.textContent = 'Please enter some text to correct.';
      correctedText.style.color = 'orange';
      copyButton.style.display = 'none'; // Ẩn nút Copy nếu không có văn bản
      copyStatus.style.display = 'none'; // Ẩn trạng thái copy
      return;
    }

    if (!geminiApiKey) {
      correctedText.textContent = 'Error: Google Gemini API Key is not set. Please set it in the API Key Setup section.';
      correctedText.style.color = 'red';
      copyButton.style.display = 'none'; // Ẩn nút Copy
      copyStatus.style.display = 'none'; // Ẩn trạng thái copy
      return;
    }

    correctedText.textContent = 'Correcting... Please wait.';
    correctedText.style.color = 'gray';
    copyButton.style.display = 'none'; // Ẩn nút Copy khi đang xử lý
    copyStatus.style.display = 'none'; // Ẩn trạng thái copy

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'correctText',
        text: textToCorrect,
        apiKey: geminiApiKey
      });

      if (response.success) {
        correctedText.textContent = response.correctedText;
        correctedText.style.color = 'black';
        // Hiển thị nút Copy khi có kết quả thành công
        if (response.correctedText) { // Chỉ hiển thị nếu có văn bản thực sự
            copyButton.style.display = 'block';
        } else {
            copyButton.style.display = 'none';
        }
      } else {
        correctedText.textContent = `Error: ${response.error || 'Unknown error'}`;
        correctedText.style.color = 'red';
        copyButton.style.display = 'none'; // Ẩn nút Copy nếu có lỗi
      }
    } catch (error) {
      correctedText.textContent = `An unexpected error occurred: ${error.message}`;
      correctedText.style.color = 'red';
      copyButton.style.display = 'none'; // Ẩn nút Copy nếu có lỗi
      console.error('Error in popup.js:', error);
    }
  });

  // Xử lý sự kiện click cho nút Copy
  copyButton.addEventListener('click', () => {
    const textToCopy = correctedText.textContent;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          copyStatus.textContent = 'Copied!';
          copyStatus.style.display = 'inline';
          setTimeout(() => {
            copyStatus.style.display = 'none';
          }, 2000); // Ẩn thông báo sau 2 giây
        })
        .catch(err => {
          console.error('Could not copy text: ', err);
          copyStatus.textContent = 'Failed to copy!';
          copyStatus.style.color = 'red';
          copyStatus.style.display = 'inline';
          setTimeout(() => {
            copyStatus.style.display = 'none';
          }, 2000);
        });
    }
  });
});