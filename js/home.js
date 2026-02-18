/**
 * Nexus Application Logic
 * Modules: Mobile Menu, Theme Toggle, Task Persistence, Table Sorting, Smooth Scroll
 */

(function() {
    'use strict';

    // --- Utils ---
    const select = (selector) => document.querySelector(selector);
    const selectAll = (selector) => document.querySelectorAll(selector);

    // --- 1. Mobile Navigation & Focus Trap ---
    const initMobileMenu = () => {
        const toggleBtn = select('.mobile-toggle');
        const nav = select('#primary-nav');
        const body = document.body;
        const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

        function toggleMenu() {
            const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
            
            toggleBtn.setAttribute('aria-expanded', !isExpanded);
            nav.classList.toggle('is-open');
            body.style.overflow = !isExpanded ? 'hidden' : ''; // Prevent body scroll

            if (!isExpanded) {
                // Wait for transition then focus first item
                setTimeout(() => {
                    const firstFocusable = nav.querySelectorAll(focusableElements)[0];
                    if(firstFocusable) firstFocusable.focus();
                }, 100);
                document.addEventListener('keydown', trapFocus);
            } else {
                document.removeEventListener('keydown', trapFocus);
            }
        }

        function trapFocus(e) {
            if (e.key === 'Escape') {
                toggleMenu();
                toggleBtn.focus();
                return;
            }

            const isTabPressed = e.key === 'Tab';
            if (!isTabPressed) return;

            const focusableContent = nav.querySelectorAll(focusableElements);
            const first = focusableContent[0];
            const last = focusableContent[focusableContent.length - 1];

            if (e.shiftKey) { // Shift + Tab
                if (document.activeElement === first) {
                    last.focus();
                    e.preventDefault();
                }
            } else { // Tab
                if (document.activeElement === last) {
                    first.focus();
                    e.preventDefault();
                }
            }
        }

        toggleBtn.addEventListener('click', toggleMenu);
        
        // Close menu when clicking a link inside it
        nav.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' && nav.classList.contains('is-open')) {
                toggleMenu();
            }
        });
    };

    // --- 2. Theme Toggle (Persistence) ---
    const initThemeToggle = () => {
        const toggleBtn = select('#theme-toggle');
        const html = document.documentElement;
        const STORAGE_KEY = 'nexus-theme';

        // Check preference
        const savedTheme = localStorage.getItem(STORAGE_KEY);
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme) {
            html.setAttribute('data-theme', savedTheme);
        } else if (systemPrefersDark) {
            html.setAttribute('data-theme', 'dark');
        }

        toggleBtn.addEventListener('click', () => {
            const currentTheme = html.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            html.setAttribute('data-theme', newTheme);
            localStorage.setItem(STORAGE_KEY, newTheme);
        });
    };

    // --- 3. Task List (Persistence) ---
    const initTaskCheckboxes = () => {
        const checkboxes = selectAll('.task-checkbox');
        const STORAGE_KEY_PREFIX = 'nexus-task-';

        checkboxes.forEach(checkbox => {
            const id = checkbox.id;
            
            // Load state
            const savedState = localStorage.getItem(STORAGE_KEY_PREFIX + id);
            if (savedState === 'true') {
                checkbox.checked = true;
            } else if (savedState === 'false') {
                checkbox.checked = false;
            }

            // Save state on change
            checkbox.addEventListener('change', () => {
                localStorage.setItem(STORAGE_KEY_PREFIX + id, checkbox.checked);
            });
        });
    };

    // --- 4. Table Sorting (Accessibility) ---
    const initTableSort = () => {
        const table = select('#project-table');
        const headers = table.querySelectorAll('th button.sort-btn');
        const tbody = table.querySelector('tbody');
        const announcer = select('#sort-announcer');

        headers.forEach(btn => {
            btn.addEventListener('click', () => {
                const colIndex = parseInt(btn.dataset.col);
                const currentSort = btn.getAttribute('aria-sort');
                const newSort = currentSort === 'ascending' ? 'descending' : 'ascending';
                
                // Reset other headers
                headers.forEach(h => h.setAttribute('aria-sort', 'none'));
                btn.setAttribute('aria-sort', newSort);

                // Sort Rows
                const rows = Array.from(tbody.querySelectorAll('tr'));
                rows.sort((a, b) => {
                    const aText = a.children[colIndex].textContent.trim().toLowerCase();
                    const bText = b.children[colIndex].textContent.trim().toLowerCase();

                    if (newSort === 'ascending') {
                        return aText.localeCompare(bText);
                    } else {
                        return bText.localeCompare(aText);
                    }
                });

                // Update DOM
                rows.forEach(row => tbody.appendChild(row));

                // Live announcement for Screen Readers
                const headerName = btn.textContent.trim().replace('↕', '');
                announcer.textContent = `Sorted by ${headerName} ${newSort}`;
            });
        });
    };

    // --- 5. Smooth Scroll ---
    const initSmoothScroll = () => {
        const triggers = selectAll('.js-scroll-trigger');
        
        triggers.forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = trigger.getAttribute('href');
                const target = select(targetId);
                
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                    // Move focus to target for accessibility
                    target.setAttribute('tabindex', '-1');
                    target.focus();
                }
            });
        });
    };

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
        initMobileMenu();
        initThemeToggle();
        initTaskCheckboxes();
        initTableSort();
        initSmoothScroll();
    });

})();