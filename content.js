(async () => {
    // Check if API key is stored, if not, we can't operate
    let geminiApiKey = await new Promise(resolve => {
        chrome.storage.local.get(['geminiApiKey'], (result) => {
            resolve(result.geminiApiKey);
        });
    });

    if (!geminiApiKey) {
        console.warn("MCPS Extension: No Gemini API Key found. Content script won't operate fully.");
        // You might want to show a subtle message to the user that API key is missing
        return;
    }

    const OBSERVER_CONFIG = { childList: true, subtree: true };
    const processedElements = new Set(); // To avoid processing the same element multiple times

    // KHAI BÁO suggestionPopover Ở ĐÂY ĐỂ CÓ PHẠM VI TOÀN CỤC TRONG IIFE
    let suggestionPopover = null; // Di chuyển khai báo này ra ngoài injectCorrectButton

    function injectCorrectButton(textarea) {
        if (processedElements.has(textarea)) {
            return; // Already processed
        }
        processedElements.add(textarea);

        // Tạo nút
        const correctButton = document.createElement('button');
        correctButton.className = 'mcps-correct-button';
        correctButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
        `;
        correctButton.title = 'Correct Text';

        // Tìm phần tử cha để chèn nút vào
        const parentOfInput = textarea.parentNode;
        if (window.getComputedStyle(parentOfInput).position === 'static') {
            parentOfInput.style.position = 'relative';
        }

        // Chèn nút vào phần tử cha của textarea
        parentOfInput.insertBefore(correctButton, textarea.nextSibling);

        // Hàm để cập nhật vị trí nút (ẩn/hiện khi cuộn)
        function updateButtonVisibility() {
            correctButton.style.display = 'flex';
        }

        // Cập nhật vị trí lần đầu
        updateButtonVisibility();

        // Lắng nghe sự kiện cuộn và thay đổi kích thước để cập nhật vị trí
        window.addEventListener('scroll', updateButtonVisibility);
        window.addEventListener('resize', updateButtonVisibility);

        // Sử dụng ResizeObserver để theo dõi sự thay đổi kích thước của textarea
        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    if (entry.target === textarea) {
                        updateButtonVisibility();
                    }
                }
            });
            resizeObserver.observe(textarea);
        }

        correctButton.addEventListener('click', async () => {
            const originalText = textarea.value;

            if (!originalText.trim()) {
                alert("Please enter some text to correct.");
                return;
            }

            // Remove existing popover if any
            if (suggestionPopover) {
                suggestionPopover.remove();
                suggestionPopover = null;
            }

            // Show loading state
            suggestionPopover = createPopover(textarea, 'Loading...');
            const loadingSpinner = document.createElement('span');
            loadingSpinner.className = 'mcps-loading-spinner';
            suggestionPopover.querySelector('p').prepend(loadingSpinner);
            suggestionPopover.querySelector('p').style.display = 'flex';
            suggestionPopover.querySelector('p').style.alignItems = 'center';

            try {
                // Send message to background script for API call
                const response = await chrome.runtime.sendMessage({
                    action: 'correctText',
                    text: originalText,
                    apiKey: geminiApiKey
                });

                if (response.success) {
                    const correctedText = response.correctedText;
                    if (correctedText) {
                        renderPopover(textarea, originalText, correctedText);
                    } else {
                        renderPopover(textarea, originalText, "No corrections suggested.");
                    }
                } else {
                    renderPopover(textarea, originalText, `Error: ${response.error || 'Unknown error'}`);
                }
            } catch (error) {
                renderPopover(textarea, originalText, `An unexpected error occurred: ${error.message}`);
                console.error('MCPS Content Script Error:', error);
            }
        });
    }

    function createPopover(targetElement, content) {
        const popover = document.createElement('div');
        popover.className = 'mcps-suggestion-popover';
        popover.innerHTML = `<p>${content}</p>`;

        // Position the popover relative to the target element
        const rect = targetElement.getBoundingClientRect();
        popover.style.top = `${window.scrollY + rect.bottom + 5}px`; // 5px below the element
        popover.style.left = `${window.scrollX + rect.left}px`;
        popover.style.minWidth = `${rect.width * 0.8}px`; // Make it a bit narrower than the input

        document.body.appendChild(popover);
        return popover;
    }

    function renderPopover(textarea, originalText, correctedText) {
        // Lỗi xảy ra ở đây vì suggestionPopover không được định nghĩa trong phạm vi này
        if (suggestionPopover) {
            suggestionPopover.remove(); // Remove old one
        }

        suggestionPopover = createPopover(textarea, ''); // Create fresh popover

        const originalP = document.createElement('p');
        originalP.className = 'original-text';
        originalP.textContent = `Original: ${originalText}`;
        suggestionPopover.appendChild(originalP);

        const correctedP = document.createElement('p');
        correctedP.className = 'corrected-text';
        correctedP.textContent = `Corrected: ${correctedText}`;
        suggestionPopover.appendChild(correctedP);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'mcps-actions';

        const applyButton = document.createElement('button');
        applyButton.textContent = 'Apply';
        applyButton.addEventListener('click', () => {
            textarea.value = correctedText;
            if (textarea.contentEditable === 'true') {
                   textarea.innerHTML = correctedText;
            } else {
                   textarea.value = correctedText;
            }

            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            textarea.dispatchEvent(new Event('blur', { bubbles: true })); // Simulate blur to save changes

            if (suggestionPopover) suggestionPopover.remove();
            suggestionPopover = null;
        });
        actionsDiv.appendChild(applyButton);

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'mcps-cancel';
        cancelButton.addEventListener('click', () => {
            if (suggestionPopover) suggestionPopover.remove();
            suggestionPopover = null;
        });
        actionsDiv.appendChild(cancelButton);

        suggestionPopover.appendChild(actionsDiv);
    }


    // Function to find and process textareas/inputs on the page
    function findAndProcessElements() {
        // Look for standard textareas
        document.querySelectorAll('textarea:not([data-mcps-processed="true"])').forEach(textarea => {
            textarea.setAttribute('data-mcps-processed', 'true'); // Mark as processed
            injectCorrectButton(textarea);
        });

        // Look for contenteditable divs (common in rich text editors)
        document.querySelectorAll('div[contenteditable="true"]:not([data-mcps-processed="true"])').forEach(div => {
            if (div.offsetParent && div.offsetParent.classList.contains('editor-area') ||
                div.closest('.akEditor'))
                {
                    div.setAttribute('data-mcps-processed', 'true');
                    const mockTextarea = {
                        value: div.innerText,
                        set value(val) { div.innerText = val; },
                        contentEditable: 'true',
                        parentNode: div.parentNode,
                        getBoundingClientRect: () => div.getBoundingClientRect(),
                        dispatchEvent: (event) => div.dispatchEvent(event)
                    };
                    injectCorrectButton(mockTextarea);
            }
        });

        // JIRA (Cloud): Comment/Description editor
        document.querySelectorAll('.ak-editor-content-area div[contenteditable="true"]:not([data-mcps-processed="true"])').forEach(div => {
            div.setAttribute('data-mcps-processed', 'true');
            const mockTextarea = {
                value: div.innerText,
                set value(val) { div.innerText = val; },
                contentEditable: 'true',
                parentNode: div.parentNode,
                getBoundingClientRect: () => div.getBoundingClientRect(),
                dispatchEvent: (event) => div.dispatchEvent(event)
            };
            injectCorrectButton(mockTextarea);
        });

        // Azure DevOps: Work item description/comment
        document.querySelectorAll('textarea[aria-label="Description"]:not([data-mcps-processed="true"]), textarea[aria-label="Discussion"]:not([data-mcps-processed="true"]), .ms-TextField-field[data-editor-id]:not([data-mcps-processed="true"])').forEach(input => {
            input.setAttribute('data-mcps-processed', 'true');
            injectCorrectButton(input);
        });
    }

    // Run the initial scan
    findAndProcessElements();

    // Use a MutationObserver to detect new elements added to the DOM (e.g., when modals open)
    const observer = new MutationObserver(findAndProcessElements);
    observer.observe(document.body, OBSERVER_CONFIG);

    // Also listen for messages from popup.js to get API key if it's set later
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'apiKeyUpdated') {
            geminiApiKey = request.apiKey;
            console.log("MCPS Content Script: API Key updated from popup.");
            findAndProcessElements(); // Re-scan in case we couldn't operate before
        }
    });

})(); // IIFE to keep variables private