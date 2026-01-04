
import { state, saveLocalBookmarks, getCurrentFolderId } from './state.js';
import { displayItems, reloadCurrentFolder } from './bookmarks.js';

export function setupModals() {
    setupAddBookmarkModal();
    setupImportModal();
}

function setupAddBookmarkModal() {
    const modal = document.getElementById('add-bookmark-modal');
    const closeBtn = modal.querySelector('.modal-close-btn');
    const cancelBtn = document.getElementById('modal-cancel');
    const saveBtn = document.getElementById('modal-save');
    const overlay = document.getElementById('add-bookmark-modal');

    function closeModal() {
        modal.classList.add('hidden');
        // Clear inputs
        document.getElementById('bookmark-title').value = '';
        document.getElementById('bookmark-url').value = '';
        document.getElementById('bookmark-location').value = 'tabaq';
    }

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Close on click outside
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });

    saveBtn.addEventListener('click', async () => {
        const title = document.getElementById('bookmark-title').value.trim();
        const url = document.getElementById('bookmark-url').value.trim();
        const location = document.getElementById('bookmark-location').value;

        if (!title || !url) {
            alert('タイトルとURLを入力してください');
            return;
        }

        try {
            if (location === 'tabaq') {
                // Save locally
                const currentFolderId = getCurrentFolderId();
                const newBookmark = {
                    id: 'local-' + Date.now(),
                    title: title,
                    url: url,
                    parentId: currentFolderId,
                    dateAdded: Date.now(),
                    type: 'local'
                };

                state.localBookmarks.push(newBookmark);
                saveLocalBookmarks();

                await reloadCurrentFolder();

            } else {
                // Save to Firefox
                await browser.bookmarks.create({
                    parentId: location,
                    title: title,
                    url: url
                });

                await reloadCurrentFolder();
            }

            closeModal();
        } catch (error) {
            console.error('保存エラー:', error);
            alert('ブックマークの保存に失敗しました: ' + error.message);
        }
    });
}

function setupImportModal() {
    const modal = document.getElementById('import-modal');
    const closeBtn = modal.querySelector('.modal-close-btn');
    const cancelBtn = document.getElementById('import-cancel');
    const executeBtn = document.getElementById('import-execute');
    const overlay = document.getElementById('import-modal');

    function closeModal() {
        modal.classList.add('hidden');
        document.getElementById('import-tree-container').innerHTML = '';
    }

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });

    executeBtn.addEventListener('click', async () => {
        const checkedBoxes = document.querySelectorAll('.import-checkbox:checked');
        if (checkedBoxes.length === 0) {
            alert('インポートする項目を選択してください');
            return;
        }

        let importCount = 0;
        const newBookmarks = [];

        try {
            for (const box of checkedBoxes) {
                const id = box.dataset.id;
                // Fetch the node (we need to fetch it again or store it)
                // We'll just fetch again for simplicity or use the data attached

                // If it's a folder, we might need to fetch children recursively?
                // The current requirement is "Select files" (items). 
                // If user selects a folder, do we import the folder and its contents? Yes, usually.
                // If user selects a bookmark, importing just that bookmark.

                // However, fetching individual items by ID is asynchronous.
                // It's better if we just re-traverse the tree or use `browser.bookmarks.getSubTree(id)`.

                const subTree = await browser.bookmarks.getSubTree(id);
                const node = subTree[0];

                // Helper to import recursively
                function traverseAndImport(n, targetParentId) {
                    const newId = 'local-' + crypto.randomUUID();
                    const newItem = {
                        id: newId,
                        title: n.title || (n.url ? 'No Title' : 'Folder'),
                        url: n.url,
                        parentId: targetParentId, // Initially root or the ID of the newly created parent folder
                        dateAdded: Date.now(),
                        type: 'local'
                    };

                    newBookmarks.push(newItem);
                    importCount++;

                    if (!n.url && n.children) {
                        n.children.forEach(child => traverseAndImport(child, newId));
                    }
                }

                // We import everything to the CURRENT folder or Root of TABaq?
                // "Import from Firefox" usually means bringing it into the workspace.
                // Let's import to the current folder.
                const currentFolderId = getCurrentFolderId();
                traverseAndImport(node, currentFolderId);
            }

            state.localBookmarks.push(...newBookmarks);
            saveLocalBookmarks();

            alert(`${importCount}件のブックマークをインポートしました`);
            closeModal();
            reloadCurrentFolder();

        } catch (error) {
            console.error('Import error:', error);
            alert('インポートに失敗しました');
        }
    });
}

export async function openAddBookmarkModal() {
    const modal = document.getElementById('add-bookmark-modal');
    const locationSelect = document.getElementById('bookmark-location');
    const firefoxGroup = document.getElementById('firefox-folders-optgroup');

    // Clear previous options in the group
    firefoxGroup.innerHTML = '';

    // Populate Firefox folders
    try {
        const tree = await browser.bookmarks.getTree();
        const folders = [];
        function traverse(node, depth = 0) {
            if (!node.url && node.id !== 'root') { // It's a folder
                folders.push({ node, depth });
                if (node.children) {
                    node.children.forEach(child => traverse(child, depth + 1));
                }
            }
        }

        tree[0].children.forEach(child => traverse(child));

        folders.forEach(({ node, depth }) => {
            const option = document.createElement('option');
            option.value = node.id;
            option.textContent = '- '.repeat(depth) + (node.title || '(No Title)');
            firefoxGroup.appendChild(option);
        });

        locationSelect.value = 'tabaq';
        document.getElementById('bookmark-title').focus();

    } catch (error) {
        console.error('Error fetching folders:', error);
    }

    modal.classList.remove('hidden');
}

export async function openImportModal() {
    const modal = document.getElementById('import-modal');
    const container = document.getElementById('import-tree-container');
    container.innerHTML = '<div class="loading">Loading...</div>'; // Simple text loading

    modal.classList.remove('hidden');

    try {
        const tree = await browser.bookmarks.getTree();
        const rootChildren = tree[0].children; // Menu, Toolbar, etc.

        container.innerHTML = '';

        // Recursive tree rendering
        function createTreeElement(node, level = 0) {
            const div = document.createElement('div');
            div.style.paddingLeft = `${level * 20}px`;
            div.style.marginBottom = '4px';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '8px';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'import-checkbox';
            checkbox.dataset.id = node.id;
            // Also store type? No, id is enough.

            const icon = document.createElement('span');
            // Simple icon
            if (!node.url) {
                icon.innerHTML = '📁';
            } else {
                icon.innerHTML = '🌐';
            }
            icon.style.opacity = '0.7';

            const label = document.createElement('span');
            label.textContent = node.title || (node.url ? node.url : 'No Title');
            label.style.overflow = 'hidden';
            label.style.textOverflow = 'ellipsis';
            label.style.whiteSpace = 'nowrap';
            label.style.fontSize = '0.9rem';

            div.appendChild(checkbox);
            div.appendChild(icon);
            div.appendChild(label);

            const wrapper = document.createElement('div');
            wrapper.appendChild(div);

            if (!node.url && node.children && node.children.length > 0) {
                // Children container
                const childrenDiv = document.createElement('div');
                // For now, let's keep it expanded or flatten?
                // Let's just render children recursively
                node.children.forEach(child => {
                    childrenDiv.appendChild(createTreeElement(child, level + 1));
                });
                wrapper.appendChild(childrenDiv);
            }

            return wrapper;
        }

        rootChildren.forEach(child => {
            // We usually don't want to import "Tags" or weird root folders, but "Menu" "Toolbar" "Unfiled" are standard
            container.appendChild(createTreeElement(child));
        });

    } catch (e) {
        console.error(e);
        container.innerHTML = 'Error loading bookmarks';
    }
}



async function refreshCurrentView() {
    const currentFolderId = getCurrentFolderId();
    let children = [];

    // 1. Get browser bookmarks for this folder
    if (currentFolderId === 'root') {
        const tree = await browser.bookmarks.getTree();
        children = tree[0].children || [];
    } else {
        try {
            children = await browser.bookmarks.getChildren(currentFolderId);
        } catch (e) {
            console.error(e);
        }
    }

    // 2. Get local bookmarks for this folder
    const locals = state.localBookmarks.filter(b => b.parentId === currentFolderId);

    // 3. Merge
    const merged = [...children, ...locals];

    displayItems(merged);
}
