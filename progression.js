// Salary Progression Calculator
class SalaryProgressionCalculator {
    constructor() {
        this.form = document.getElementById('progression-form');
        this.resultDiv = document.getElementById('result');
        this.tableBody = document.getElementById('table-body');
        this.promotionSchedule = document.getElementById('promotion-schedule');
        this.selectedYears = new Set(); // No default selections
        
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.initializeForm();
        this.initializePromotionSchedule();
    }

    initializeForm() {
        // Add input validation and real-time updates
        const inputs = this.form.querySelectorAll('input[type="text"]');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.validateInput(input));
        });
    }

    initializePromotionSchedule() {
        this.promotionSchedule.innerHTML = '';
        
        for (let year = 1; year <= 20; year++) {
            const yearBox = document.createElement('div');
            yearBox.className = 'year-box';
            yearBox.textContent = year;
            yearBox.dataset.year = year;
            
            if (this.selectedYears.has(year)) {
                yearBox.classList.add('selected');
            }
            
            yearBox.addEventListener('click', () => this.toggleYear(year, yearBox));
            this.promotionSchedule.appendChild(yearBox);
        }
    }

    toggleYear(year, element) {
        if (this.selectedYears.has(year)) {
            this.selectedYears.delete(year);
            element.classList.remove('selected');
        } else {
            this.selectedYears.add(year);
            element.classList.add('selected');
        }
    }

    validateInput(input) {
        const errorElement = document.getElementById(input.id + '-error');
        let isValid = true;
        let errorMessage = '';

        const value = parseFloat(input.value);
        const min = parseFloat(input.min);
        const max = parseFloat(input.max);

        if (input.value === '') {
            isValid = false;
            errorMessage = 'This field is required';
        } else if (isNaN(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid number';
        } else if (value < min) {
            isValid = false;
            errorMessage = `Value must be at least ${min}`;
        } else if (max && value > max) {
            isValid = false;
            errorMessage = `Value must be at most ${max}`;
        }

        if (errorElement) {
            errorElement.textContent = errorMessage;
            errorElement.style.display = isValid ? 'none' : 'block';
        }

        return isValid;
    }

    validateForm() {
        const inputs = this.form.querySelectorAll('input[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!this.validateInput(input)) {
                isValid = false;
            }
        });

        return isValid;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    formatPercentage(value) {
        return `${value.toFixed(1)}%`;
    }

    calculateProgression(data) {
        const progression = [];
        let currentSalary = data.startingSalary;
        let totalEarned = 0;
        let previousSalary = currentSalary;
        let promotionNumber = 0;

        for (let year = 0; year <= 20; year++) {
            const startingSalary = currentSalary;
            
            // Apply COL increase every year (except year 0) - based on starting salary
            const colIncrease = year > 0 ? startingSalary * (data.colCompensation / 100) : 0;
            
            // Apply promotion increase if it's a promotion year - based on starting salary
            const promotionIncrease = year > 0 && this.selectedYears.has(year) ? startingSalary * (data.promotionIncrease / 100) : 0;
            
            if (year > 0 && this.selectedYears.has(year)) {
                promotionNumber++;
            }
            
            const finalSalary = startingSalary + colIncrease + promotionIncrease;
            currentSalary = finalSalary; // Update for next year
            
            // Calculate total increase (COL + promotion)
            let increase = 0;
            if (year > 0) {
                const previousSalary = year === 1 ? data.startingSalary : progression[progression.length - 1].finalSalary;
                increase = ((finalSalary - previousSalary) / previousSalary) * 100;
            }

            progression.push({
                year,
                promotionNumber: year > 0 && this.selectedYears.has(year) ? promotionNumber : 0,
                startingSalary,
                finalSalary,
                colCompensation: colIncrease,
                promotionRaise: promotionIncrease,
                increase
            });

            totalEarned += finalSalary;
            previousSalary = currentSalary;
        }

        return {
            progression,
            finalSalary: currentSalary,
            totalEarned,
            totalIncrease: ((currentSalary - data.startingSalary) / data.startingSalary) * 100,
            avgAnnualGrowth: Math.pow(currentSalary / data.startingSalary, 1/20) - 1
        };
    }

    displayResults(results) {
        // Update summary stats
        document.getElementById('final-salary').textContent = this.formatCurrency(results.finalSalary);
        document.getElementById('total-earned').textContent = this.formatCurrency(results.totalEarned);
        document.getElementById('total-increase').textContent = this.formatPercentage(results.totalIncrease);
        document.getElementById('avg-annual-growth').textContent = this.formatPercentage(results.avgAnnualGrowth * 100);

        // Generate table
        this.tableBody.innerHTML = '';
        
        results.progression.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="year-column">${row.year}</td>
                <td class="year-column">${row.promotionNumber > 0 ? row.promotionNumber : '-'}</td>
                <td class="salary-column">${this.formatCurrency(row.startingSalary)}</td>
                <td>${this.formatCurrency(row.colCompensation)}</td>
                <td>${row.promotionRaise > 0 ? this.formatCurrency(row.promotionRaise) : '-'}</td>
                <td class="salary-column">${this.formatCurrency(row.finalSalary)}</td>
                <td>${row.increase > 0 ? '+' : ''}${this.formatPercentage(row.increase)}</td>
            `;
            this.tableBody.appendChild(tr);
        });

        this.resultDiv.classList.remove('hidden');
    }

    handleSubmit(e) {
        e.preventDefault();

        if (!this.validateForm()) {
            return;
        }

        const formData = new FormData(this.form);
        const data = {
            startingSalary: parseFloat(formData.get('starting-salary')),
            colCompensation: parseFloat(formData.get('col-compensation')) || 0,
            promotionIncrease: parseFloat(formData.get('promotion-increase'))
        };

        const results = this.calculateProgression(data);
        this.displayResults(results);

        // Scroll to results
        this.resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Initialize the calculator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SalaryProgressionCalculator();
});
