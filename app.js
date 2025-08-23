// COL Converter Application
class COLConverter {
    constructor() {
        this.msaData = [];
        this.rppCache = {};
        this.cityOptions = [];
        this.form = document.getElementById('converter-form');
        this.result = document.getElementById('result');
        this.loading = document.getElementById('loading');
        this.copyLinkBtn = document.getElementById('copy-link-btn');
        
        this.init();
    }

    async init() {
        await Promise.all([
            this.loadMSAData(),
            this.loadRPPCache()
        ]);
        this.populateCityOptions();
        this.setupEventListeners();
        this.hydrateFromURL();
    }

    async loadMSAData() {
        try {
            const response = await fetch('data/msas.json');
            this.msaData = await response.json();
            console.log('MSA data loaded successfully:', this.msaData.length, 'entries');
        } catch (error) {
            console.error('Failed to load MSA data:', error);
            this.showError('Failed to load city data. Please refresh the page.');
        }
    }

    async loadRPPCache() {
        try {
            const response = await fetch('data/rpp_cache.json');
            this.rppCache = await response.json();
            console.log('RPP cache loaded successfully:', Object.keys(this.rppCache).length - 1, 'entries'); // -1 for metadata
        } catch (error) {
            console.error('Failed to load RPP cache:', error);
            this.showError('Failed to load cost of living data. Please refresh the page.');
        }
    }

    populateCityOptions() {
        const datalist = document.getElementById('cities-list');
        const options = new Set();

        this.msaData.forEach(msa => {
            // Add MSA name
            options.add(msa.msa);
            // Add all aliases
            msa.aliases.forEach(alias => options.add(alias));
        });

        this.cityOptions = Array.from(options).sort();
        
        // Clear and repopulate datalist
        datalist.innerHTML = '';
        this.cityOptions.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            datalist.appendChild(option);
        });
    }

    setupEventListeners() {
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleConvert();
        });

        this.copyLinkBtn.addEventListener('click', () => {
            this.copyShareLink();
        });

        // Add switch button functionality
        document.getElementById('switch-btn').addEventListener('click', () => {
            this.switchDirection();
        });

        // Handle Enter key on inputs
        ['from-city', 'salary', 'to-city'].forEach(id => {
            document.getElementById(id).addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleConvert();
                }
            });
        });
    }

    hydrateFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const from = urlParams.get('from');
        const to = urlParams.get('to');
        const salary = urlParams.get('salary');

        if (from) document.getElementById('from-city').value = from;
        if (to) document.getElementById('to-city').value = to;
        if (salary) document.getElementById('salary').value = salary;

        // Auto-convert if all parameters are present
        if (from && to && salary) {
            this.handleConvert();
        }
    }

    resolveCity(cityName) {
        if (!cityName) return null;

        const normalized = cityName.toLowerCase().trim().replace(/\./g, '');
        console.log('Resolving city:', cityName, 'Normalized:', normalized);
        console.log('MSA data loaded:', this.msaData.length, 'entries');
        
        // First try exact match on aliases
        for (const msa of this.msaData) {
            const exactAliasMatch = msa.aliases.find(alias => 
                alias.toLowerCase().trim().replace(/\./g, '') === normalized
            );
            if (exactAliasMatch) {
                console.log('Exact alias match found:', exactAliasMatch, 'for MSA:', msa.msa);
                return { cbsa: msa.cbsa, msa: msa.msa };
            }
        }

        // Then try contains match on aliases
        for (const msa of this.msaData) {
            const containsAliasMatch = msa.aliases.find(alias => 
                alias.toLowerCase().includes(normalized) || 
                normalized.includes(alias.toLowerCase())
            );
            if (containsAliasMatch) {
                console.log('Contains alias match found:', containsAliasMatch, 'for MSA:', msa.msa);
                return { cbsa: msa.cbsa, msa: msa.msa };
            }
        }

        // Finally try contains match on MSA name
        for (const msa of this.msaData) {
            const msaNormalized = msa.msa.toLowerCase().replace(/\./g, '');
            if (msaNormalized.includes(normalized) || normalized.includes(msaNormalized)) {
                console.log('MSA name match found:', msa.msa);
                return { cbsa: msa.cbsa, msa: msa.msa };
            }
        }

        console.log('No match found for:', cityName);
        return null;
    }

    async fetchRPP(cbsa) {
        // Use static RPP cache (no API calls needed)
        console.log('Fetching RPP from cache for CBSA:', cbsa);
        
        const data = this.rppCache[cbsa];
        if (!data) {
            throw new Error(`No RPP data found for CBSA ${cbsa}`);
        }
        
        console.log('RPP data found:', data);
        return data;
    }

    async handleConvert() {
        this.clearErrors();
        this.hideResult();
        this.showLoading();

        try {
            const fromCity = document.getElementById('from-city').value.trim();
            const toCity = document.getElementById('to-city').value.trim();
            const salary = parseFloat(document.getElementById('salary').value);

            // Validate inputs
            if (!fromCity || !toCity || !salary) {
                throw new Error('Please fill in all fields');
            }

            if (salary < 15000 || salary > 5000000) {
                throw new Error('Salary must be between $15,000 and $5,000,000');
            }

            // Resolve cities
            const fromMSA = this.resolveCity(fromCity);
            const toMSA = this.resolveCity(toCity);

            if (!fromMSA) {
                this.showFieldError('from-error', 'City not recognized. Try a nearby major city.');
                return;
            }

            if (!toMSA) {
                this.showFieldError('to-error', 'City not recognized. Try a nearby major city.');
                return;
            }

            if (fromMSA.cbsa === toMSA.cbsa) {
                this.showFieldError('to-error', 'Please select a different destination city.');
                return;
            }

            // Fetch RPP data
            const [fromRPP, toRPP] = await Promise.all([
                this.fetchRPP(fromMSA.cbsa),
                this.fetchRPP(toMSA.cbsa)
            ]);

            // Calculate equivalent salary
            const ratio = toRPP.value / fromRPP.value;
            const equivalent = salary * ratio;
            const delta = ((equivalent - salary) / salary) * 100;

            // Display results
            this.displayResults({
                fromMSA,
                toMSA,
                salary,
                equivalent,
                delta,
                fromRPP,
                toRPP,
                ratio
            });

            // Update URL
            this.updateShareLink(fromCity, toCity, salary);

        } catch (error) {
            console.error('Conversion error:', error);
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }

    displayResults(data) {
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        });

        // Main result
        const equivalentSalaryElement = document.getElementById('equivalent-salary');
        equivalentSalaryElement.textContent = formatter.format(data.equivalent);
        
        // Set color based on whether it's cheaper or more expensive
        if (data.delta < 0) {
            equivalentSalaryElement.style.color = '#28a745'; // Green for cheaper
        } else if (data.delta > 0) {
            equivalentSalaryElement.style.color = '#dc3545'; // Red for more expensive
        } else {
            equivalentSalaryElement.style.color = '#6c757d'; // Gray for same cost
        }
        
        // Delta pill
        const deltaPill = document.getElementById('delta-pill');
        deltaPill.textContent = `${data.delta > 0 ? '+' : ''}${data.delta.toFixed(1)}% ${data.delta > 0 ? 'more expensive' : data.delta < 0 ? 'cheaper' : 'same cost'}`;
        deltaPill.className = `delta-pill ${data.delta > 0 ? 'positive' : data.delta < 0 ? 'negative' : 'neutral'}`;

                       // Meta info
               document.getElementById('result-meta').textContent = 
                   `${data.fromMSA.msa} RPP ${data.fromRPP.value.toFixed(1)} → ${data.toMSA.msa} RPP ${data.toRPP.value.toFixed(1)}`;



        this.showResult();
    }

    updateShareLink(from, to, salary) {
        const url = new URL(window.location);
        url.searchParams.set('from', from);
        url.searchParams.set('to', to);
        url.searchParams.set('salary', salary);
        
        window.history.replaceState({}, '', url);
    }

    async copyShareLink() {
        try {
            await navigator.clipboard.writeText(window.location.href);
            
            const originalText = this.copyLinkBtn.textContent;
            this.copyLinkBtn.textContent = 'Copied!';
            this.copyLinkBtn.style.background = '#28a745';
            this.copyLinkBtn.style.color = 'white';
            
            setTimeout(() => {
                this.copyLinkBtn.textContent = originalText;
                this.copyLinkBtn.style.background = '';
                this.copyLinkBtn.style.color = '';
            }, 2000);
        } catch (error) {
            console.error('Failed to copy link:', error);
            this.showError('Failed to copy link to clipboard');
        }
    }

    switchDirection() {
        const fromCity = document.getElementById('from-city').value;
        const toCity = document.getElementById('to-city').value;
        const salary = document.getElementById('salary').value;

        // Swap the cities
        document.getElementById('from-city').value = toCity;
        document.getElementById('to-city').value = fromCity;
        
        // Keep the same salary
        document.getElementById('salary').value = salary;

        // Trigger the conversion
        this.handleConvert();
    }

    showResult() {
        this.result.classList.remove('hidden');
    }

    hideResult() {
        this.result.classList.add('hidden');
    }

    showLoading() {
        this.loading.classList.remove('hidden');
    }

    hideLoading() {
        this.loading.classList.add('hidden');
    }

    clearErrors() {
        ['from-error', 'salary-error', 'to-error'].forEach(id => {
            document.getElementById(id).textContent = '';
        });
    }

    showFieldError(fieldId, message) {
        document.getElementById(fieldId).textContent = message;
    }

    showError(message) {
        // For now, show as alert. In a real app, you might want a toast notification
        alert(message);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new COLConverter();
});
