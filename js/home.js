document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Mobile Menu Toggle ---
    const mobileToggle = document.querySelector('.mobile-toggle');
    const navContainer = document.querySelector('.nav-container');

    if (mobileToggle && navContainer) {
        mobileToggle.addEventListener('click', () => {
            const isExpanded = mobileToggle.getAttribute('aria-expanded') === 'true';
            
            mobileToggle.setAttribute('aria-expanded', !isExpanded);
            navContainer.classList.toggle('is-open');
        });

        // Close menu when clicking a link (mobile)
        const navLinks = navContainer.querySelectorAll('.js-scroll-trigger');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (navContainer.classList.contains('is-open')) {
                    mobileToggle.setAttribute('aria-expanded', 'false');
                    navContainer.classList.remove('is-open');
                }
            });
        });
    }

    // --- 2. Smooth Scrolling to Sections ---
    // Note: CSS html { scroll-behavior: smooth; } handles the actual scrolling,
    // this script just ensures the URL anchor doesn't jump abruptly before the CSS animation kicks in.
    const scrollTriggers = document.querySelectorAll('.js-scroll-trigger');
    
    scrollTriggers.forEach(trigger => {
        trigger.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            
            // Only apply to internal anchor links
            if (targetId.startsWith('#')) {
                e.preventDefault();
                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    // Calculate offset for the sticky header
                    const headerHeight = document.querySelector('.site-header').offsetHeight;
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerHeight - 20;
  
                    window.scrollTo({
                        top: offsetPosition,
                        behavior: "smooth"
                    });
                }
            }
        });
    });

});