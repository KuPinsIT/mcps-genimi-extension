(async () => {
    let geminiApiKey = await new Promise(resolve => {
        chrome.storage.local.get(['geminiApiKey'], (result) => {
            resolve(result.geminiApiKey);
        });
    });

    if (!geminiApiKey) {
        console.warn("MCPS Extension: No Gemini API Key found. Content script won't operate fully.");
        return;
    }

    const OBSERVER_CONFIG = { childList: true, subtree: true };
    const processedElements = new Set();
    let suggestionPopover = null;

    // Helper function to normalize element access (for textarea/input and contenteditable div)
    function normalizeInputElement(element) {
        if (element.tagName === 'TEXTAREA' || (element.tagName === 'INPUT' && element.type === 'text')) {
            return {
                originalElement: element,
                getValue: () => element.value,
                setValue: (val) => { element.value = val; },
                type: 'input',
                parentNode: element.parentNode,
                getBoundingClientRect: () => element.getBoundingClientRect(),
                dispatchEvent: (event) => element.dispatchEvent(event)
            };
        } else if (element.contentEditable === 'true') {
            // Logic cụ thể cho contenteditable (như Jira và một số editor của Azure DevOps)
            return {
                originalElement: element,
                getValue: () => {
                    let text = element.textContent || '';
                    // Loại bỏ placeholder cụ thể của Jira, có thể không ảnh hưởng đến Azure
                    text = text.replace(/Type @ to mention and notify someone\./g, '').trim();
                    return text;
                },
                setValue: (val) => {
                    const targetDiv = element;
                    targetDiv.focus();

                    const selection = window.getSelection();
                    const range = document.createRange();

                    // Xóa nội dung hiện có: chọn tất cả và xóa
                    range.selectNodeContents(targetDiv);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    document.execCommand('delete', false, null);

                    // Chèn văn bản mới
                    document.execCommand('insertText', false, val);

                    // Đặt con trỏ về cuối văn bản
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                },
                type: 'contenteditable',
                parentNode: element.parentNode,
                getBoundingClientRect: () => element.getBoundingClientRect(),
                dispatchEvent: (event) => element.dispatchEvent(event)
            };
        }
        return null;
    }

    /**
     * Injects the correction button and sets up its behavior.
     * @param {object} normalizedInput - A normalized input object with originalElement, getValue, setValue etc.
     */
    function injectCorrectButton(normalizedInput) {
        if (processedElements.has(normalizedInput.originalElement)) {
            return;
        }
        processedElements.add(normalizedInput.originalElement);

        const correctButton = document.createElement('button');
        correctButton.className = 'mcps-correct-button';
        correctButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
        `;
        correctButton.title = 'Correct Text';

        // Tìm kiếm vị trí để chèn nút.
        // Cố gắng chèn nút ĐÚNG SAU phần tử originalElement.
        const parentOfInput = normalizedInput.originalElement.parentNode;
        if (!parentOfInput) {
            console.warn("MCPS Extension: Could not find parent node for element. Button not injected.", normalizedInput.originalElement);
            return;
        }
        
        // Chèn nút. Cố gắng chèn sau phần tử gốc.
        // Đối với Jira, có thể cần một container đặc biệt như .ak-editor-content-area
        // Tuy nhiên, việc chèn nút sau phần tử originalElement thường hoạt động tốt nhất.
        normalizedInput.originalElement.insertAdjacentElement('afterend', correctButton);

        // Đảm bảo nút hiển thị và không bị che khuất
        const buttonContainer = correctButton.parentNode; // parentNode của nút chính là nơi nó được chèn vào
        if (window.getComputedStyle(buttonContainer).position === 'static') {
            buttonContainer.style.position = 'relative';
        }
        
        function updateButtonVisibility() {
            correctButton.style.display = 'flex';
        }

        updateButtonVisibility();

        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    if (entry.target === normalizedInput.originalElement) {
                        updateButtonVisibility();
                    }
                }
            });
            resizeObserver.observe(normalizedInput.originalElement);
        }

        correctButton.addEventListener('click', async (event) => {
            event.stopPropagation(); // Ngăn sự kiện click lan ra ngoài, tránh đóng popover ngay lập tức

            const originalText = normalizedInput.getValue();

            console.log("Original Text captured:", originalText);
            console.log("Original Text length:", originalText.length);
            console.log("Trimmed Original Text length:", originalText.trim().length);

            if (!originalText.trim()) {
                alert("Please enter some text to correct.");
                return;
            }

            if (suggestionPopover) {
                suggestionPopover.remove();
                suggestionPopover = null;
            }

            suggestionPopover = createPopover(normalizedInput.originalElement, 'Loading...');
            const loadingSpinner = document.createElement('span');
            loadingSpinner.className = 'mcps-loading-spinner';
            const popoverParagraph = suggestionPopover.querySelector('p');
            if (popoverParagraph) {
                popoverParagraph.prepend(loadingSpinner);
                popoverParagraph.style.display = 'flex';
                popoverParagraph.style.alignItems = 'center';
            }

            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'correctText',
                    text: originalText,
                    apiKey: geminiApiKey
                });

                if (response.success) {
                    const correctedText = response.correctedText;
                    if (correctedText) {
                        renderPopover(normalizedInput, originalText, correctedText);
                    } else {
                        renderPopover(normalizedInput, originalText, "No corrections suggested.");
                    }
                } else {
                    renderPopover(normalizedInput, originalText, `Error: ${response.error || 'Unknown error'}`);
                }
            } catch (error) {
                renderPopover(normalizedInput, originalText, `An unexpected error occurred: ${error.message}`);
                console.error('MCPS Content Script Error:', error);
            }
        });
    }

    function createPopover(targetElement, content) {
        const popover = document.createElement('div');
        popover.className = 'mcps-suggestion-popover';
        popover.innerHTML = `<p>${content}</p>`;

        const rect = targetElement.getBoundingClientRect();
        popover.style.top = `${window.scrollY + rect.bottom + 5}px`;
        popover.style.left = `${window.scrollX + rect.left}px`;
        popover.style.minWidth = `${rect.width * 0.8}px`;

        document.body.appendChild(popover);
        return popover;
    }

    function renderPopover(normalizedInput, originalText, correctedText) {
        if (suggestionPopover) {
            suggestionPopover.remove();
        }

        suggestionPopover = createPopover(normalizedInput.originalElement, '');

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
            normalizedInput.setValue(correctedText);

            normalizedInput.dispatchEvent(new Event('input', { bubbles: true }));
            normalizedInput.dispatchEvent(new Event('change', { bubbles: true }));
            normalizedInput.dispatchEvent(new Event('blur', { bubbles: true }));

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

    /**
     * Finds and processes elements based on the current URL.
     */
    function findAndProcessElements() {
        const url = window.location.href;

        if (url.includes('dev.azure.com') || url.includes('visualstudio.com')) {
            console.log("MCPS: Processing Azure DevOps elements.");
            // Azure DevOps: Work item description/comment (textarea)
            document.querySelectorAll(
                'textarea[aria-label="Description"]:not([data-mcps-processed="true"]), ' +
                'textarea[aria-label="Discussion"]:not([data-mcps-processed="true"])'
            ).forEach(element => {
                element.setAttribute('data-mcps-processed', 'true');
                const normalized = normalizeInputElement(element);
                if (normalized) injectCorrectButton(normalized);
            });

            // Azure DevOps: Rich text editors (contenteditable divs)
            document.querySelectorAll(
                '.ms-TextField-field[data-editor-id][contenteditable="true"]:not([data-mcps-processed="true"]), ' +
                'div.vc-richtext-editor div[contenteditable="true"]:not([data-mcps-processed="true"])'
            ).forEach(element => {
                element.setAttribute('data-mcps-processed', 'true');
                const normalized = normalizeInputElement(element);
                if (normalized) injectCorrectButton(normalized);
            });
        } else if (url.includes('atlassian.net')) {
            console.log("MCPS: Processing Jira elements.");
            // Jira Cloud: Selector for the contenteditable div within the main editor.
            // Jira Cloud: Also include standard textareas for other fields.
            document.querySelectorAll(
                '#ak-editor-textarea[contenteditable="true"]:not([data-mcps-processed="true"]), ' +
                'textarea:not([data-mcps-processed="true"])'
            ).forEach(element => {
                element.setAttribute('data-mcps-processed', 'true');
                const normalized = normalizeInputElement(element);
                if (normalized) injectCorrectButton(normalized);
            });
        }
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
            console.log("MCPS Content Script: API Key updated from popup. Re-scanning elements.");
            processedElements.clear(); // Clear processed elements to re-scan all
            findAndProcessElements();
        }
    });

    // Lắng nghe sự kiện click trên toàn bộ document để đóng popover
    document.addEventListener('click', (event) => {
        if (suggestionPopover) {
            // Kiểm tra xem click có nằm bên trong popover hay nút "Correct Text" không
            const correctButton = document.querySelector('.mcps-correct-button'); // Lấy lại tham chiếu nút
            const isClickInsidePopover = suggestionPopover.contains(event.target);
            const isClickInsideButton = correctButton && correctButton.contains(event.target);

            if (!isClickInsidePopover && !isClickInsideButton) {
                // Nếu click không nằm trong popover hoặc nút, đóng popover
                suggestionPopover.remove();
                suggestionPopover = null;
            }
        }
    });

})();