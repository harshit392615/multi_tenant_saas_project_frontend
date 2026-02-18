/**
 * WORKSPACE ENHANCEMENTS
 * Safe extension of workspace.js functionality.
 * Handles UI interactions, View Navigation, Search, and Sidebar States.
 */

(function initEnhancedWorkspace() {
    
    // --- STATE MANAGEMENT ---
    const state = {
        currentView: 'overview', // 'overview', 'boards', 'notes'
        searchQuery: '',
    };

    // --- DOM CACHE ---
    const elements = {
        sidebarSearch: document.getElementById('sidebar-search-input'),
        navbarSearch: document.getElementById('navbar-search-input'),
        navOverview: document.getElementById('nav-overview'),
        navBoards: document.getElementById('nav-boards'),
        navNotes: document.getElementById('nav-notes'),
        viewBoards: document.getElementById('view-boards'),
        viewNotes: document.getElementById('view-notes'),
        mainDivider: document.getElementById('main-divider'),
        boardsList: document.getElementById('boards-list'),
        notesList: document.getElementById('notes-list'),
        privateSection: document.getElementById('private-section'),
        privateToggle: document.querySelector('#private-section .toggle-header')
    };

    // --- 1. SIDEBAR NAVIGATION ---
    
    function updateView(viewName) {
        state.currentView = viewName;
        
        // Reset active classes
        [elements.navOverview, elements.navBoards, elements.navNotes].forEach(el => 
            el.classList.remove('active')
        );

        // Visibility Logic
        if (viewName === 'overview') {
            elements.navOverview.classList.add('active');
            elements.viewBoards.classList.remove('hidden');
            elements.viewNotes.classList.remove('hidden');
            elements.mainDivider.classList.remove('hidden');
        } 
        else if (viewName === 'boards') {
            elements.navBoards.classList.add('active');
            elements.viewBoards.classList.remove('hidden');
            elements.viewNotes.classList.add('hidden');
            elements.mainDivider.classList.add('hidden');
        } 
        else if (viewName === 'notes') {
            elements.navNotes.classList.add('active');
            elements.viewBoards.classList.add('hidden');
            elements.viewNotes.classList.remove('hidden');
            elements.mainDivider.classList.add('hidden');
        }
    }

    elements.navOverview.addEventListener('click', (e) => {
        e.preventDefault();
        updateView('overview');
    });

    elements.navBoards.addEventListener('click', (e) => {
        e.preventDefault();
        updateView('boards');
    });

    elements.navNotes.addEventListener('click', (e) => {
        e.preventDefault();
        updateView('notes');
    });

    // --- 2. SIDEBAR DROPDOWN ---
    
    if (elements.privateToggle) {
        elements.privateToggle.addEventListener('click', () => {
            elements.privateSection.classList.toggle('collapsed');
            
            // Visual rotation is handled by CSS on .arrow-icon
        });
    }

    // --- 3. SEARCH FUNCTIONALITY (Real-time, Client-side) ---

    function applySearch(query) {
        state.searchQuery = query.toLowerCase();

        // Helper to filter a UL
        const filterList = (ulElement) => {
            if (!ulElement) return;
            const items = ulElement.querySelectorAll('li');
            
            items.forEach(li => {
                // Ignore "No found" empty states
                if (li.innerText.includes("No boards found") || li.innerText.includes("No notes found")) return;
                
                const text = li.innerText.toLowerCase();
                if (text.includes(state.searchQuery)) {
                    li.classList.remove('hidden');
                } else {
                    li.classList.add('hidden');
                }
            });
        };

        filterList(elements.boardsList);
        filterList(elements.notesList);
    }

    const handleSearchInput = (e) => {
        const val = e.target.value;
        // Sync inputs
        elements.sidebarSearch.value = val;
        elements.navbarSearch.value = val;
        applySearch(val);
    };

    elements.sidebarSearch.addEventListener('input', handleSearchInput);
    elements.navbarSearch.addEventListener('input', handleSearchInput);

    // --- 4. PERSISTENCE OBSERVER (Handle dynamic updates) ---
    // The original JS rewrites innerHTML when items are created. 
    // We must re-apply our search filter if the list changes.

    const observerConfig = { childList: true };
    const listObserver = new MutationObserver((mutations) => {
        if (state.searchQuery) {
            applySearch(state.searchQuery);
        }
    });

    if (elements.boardsList) listObserver.observe(elements.boardsList, observerConfig);
    if (elements.notesList) listObserver.observe(elements.notesList, observerConfig);

    // --- INIT ---
    // Start at overview
    updateView('overview');

})();





Evaluate

Compare
