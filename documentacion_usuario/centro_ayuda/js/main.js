// Funcionalidad principal del Centro de Ayuda

document.addEventListener('DOMContentLoaded', function() {
    // Navegación por categorías
    const navItems = document.querySelectorAll('.nav-item');
    const guideCards = document.querySelectorAll('.guide-card');
    const quickAccessCards = document.querySelectorAll('.card');

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            // Remover clase active de todos
            navItems.forEach(nav => nav.classList.remove('active'));
            // Agregar clase active al actual
            this.classList.add('active');
            
            // Filtrar contenido
            const category = this.dataset.category;
            filterContent(category);
        });
    });

    function filterContent(category) {
        // Filtrar guías
        guideCards.forEach(card => {
            if (category === 'all' || card.dataset.category === category) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });

        // Filtar quick access
        quickAccessCards.forEach(card => {
            if (category === 'all' || card.dataset.category === category) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    // Búsqueda
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    function performSearch() {
        const query = searchInput.value.toLowerCase();
        
        // Buscar en guías
        guideCards.forEach(card => {
            const title = card.querySelector('h4').textContent.toLowerCase();
            const description = card.querySelector('p').textContent.toLowerCase();
            
            if (title.includes(query) || description.includes(query)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });

        // Buscar en FAQ
        const faqItems = document.querySelectorAll('.faq-item');
        faqItems.forEach(item => {
            const question = item.querySelector('.faq-question span').textContent.toLowerCase();
            const answer = item.querySelector('.faq-answer p').textContent.toLowerCase();
            
            if (question.includes(query) || answer.includes(query)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // FAQ Accordion
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', function() {
            // Cerrar otros
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle actual
            item.classList.toggle('active');
        });
    });

    // Botones de tarjetas
    const cardBtns = document.querySelectorAll('.card-btn');
    
    cardBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const card = this.closest('.card');
            const category = card.dataset.category;
            
            // Navegar a la categoría
            navItems.forEach(nav => {
                nav.classList.remove('active');
                if (nav.dataset.category === category) {
                    nav.classList.add('active');
                }
            });
            
            filterContent(category);
            
            // Scroll a guías
            document.querySelector('.guides-section').scrollIntoView({ 
                behavior: 'smooth' 
            });
        });
    });

    // Simulación de videos (cuando se agreguen videos reales)
    const videoCards = document.querySelectorAll('.video-card');
    
    videoCards.forEach(card => {
        card.addEventListener('click', function() {
            alert('Los videos estarán disponibles próximamente. Por ahora, revisa las guías escritas.');
        });
    });
});
