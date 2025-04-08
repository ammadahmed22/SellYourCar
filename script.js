document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('carSellForm');
    const photoInput = document.getElementById('photos');
    const photoPreview = document.getElementById('preview');
    const modal = document.getElementById('successModal');
    const closeModalBtn = document.querySelector('.close-modal');
    const vinInput = document.getElementById('vin');
    const licensePlateInput = document.getElementById('licensePlate');
    const stateSelect = document.getElementById('state');
    const liensSelect = document.getElementById('liens');
    const lienAmountField = document.getElementById('lienAmountField');

    // Populate US States
    const states = [
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
    ];

    states.forEach(state => {
        const option = document.createElement('option');
        option.value = state;
        option.textContent = state;
        stateSelect.appendChild(option);
    });

    // Handle VIN/License Plate requirement
    vinInput.addEventListener('input', function() {
        const hasVin = this.value.length > 0;
        licensePlateInput.required = !hasVin;
        stateSelect.required = !hasVin;
        document.getElementById('zipCode').required = !hasVin;
    });

    licensePlateInput.addEventListener('input', function() {
        const hasLicensePlate = this.value.length > 0;
        vinInput.required = !hasLicensePlate;
    });

    // Handle liens amount field visibility
    liensSelect.addEventListener('change', function() {
        const lienAmountField = document.getElementById('lienAmountField');
        const lienAmountInput = document.getElementById('lienAmount');
        const showLienAmount = this.value === 'yes';
        
        if (showLienAmount) {
            lienAmountField.classList.add('visible');
            lienAmountInput.required = true;
            // Give time for the field to become visible before focusing
            setTimeout(() => lienAmountInput.focus(), 300);
        } else {
            lienAmountField.classList.remove('visible');
            lienAmountInput.required = false;
            lienAmountInput.value = '';
        }
    });

    // Handle exclusive checkboxes
    function handleExclusiveCheckbox(groupName, noIssuesValue) {
        const checkboxes = document.querySelectorAll(`input[name="${groupName}"]`);
        const noIssuesCheckbox = document.querySelector(`input[name="${groupName}"][value="${noIssuesValue}"]`);

        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                if (this.value === noIssuesValue && this.checked) {
                    // Uncheck all other checkboxes in the group
                    checkboxes.forEach(cb => {
                        if (cb !== this) cb.checked = false;
                    });
                } else if (this.checked && noIssuesCheckbox.checked) {
                    // Uncheck the "No Issues" checkbox if any other is checked
                    noIssuesCheckbox.checked = false;
                }
            });
        });
    }

    // Set up exclusive checkboxes for each group
    handleExclusiveCheckbox('issues', 'no_mechanical');
    handleExclusiveCheckbox('engine_issues', 'no_engine');
    handleExclusiveCheckbox('exterior_damage', 'no_exterior');
    handleExclusiveCheckbox('interior_damage', 'no_interior');

    // Photo preview functionality
    photoInput.addEventListener('change', function(e) {
        photoPreview.innerHTML = '';
        const files = Array.from(e.target.files);

        files.forEach(file => {
            if (!file.type.startsWith('image/')) {
                alert('Please upload only image files');
                return;
            }

            const reader = new FileReader();
            const imgContainer = document.createElement('div');
            imgContainer.className = 'preview-image';
            
            reader.onload = function(e) {
                imgContainer.innerHTML = `
                    <img src="${e.target.result}" alt="Vehicle photo preview" style="width: 100%; height: 150px; object-fit: cover; border-radius: 4px;">
                `;
            };

            reader.readAsDataURL(file);
            photoPreview.appendChild(imgContainer);
        });
    });

    // Form validation and submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Basic validation
        const required = form.querySelectorAll('[required]');
        let isValid = true;

        required.forEach(field => {
            if (!field.value) {
                isValid = false;
                field.style.borderColor = 'var(--error-color)';
            } else {
                field.style.borderColor = 'var(--border-color)';
            }
        });

        if (!isValid) {
            alert('Please fill in all required fields');
            return;
        }

        // Validate VIN or License Plate requirement
        if (!vinInput.value && (!licensePlateInput.value || !stateSelect.value || !document.getElementById('zipCode').value)) {
            alert('Please provide either a VIN number or License Plate with State and ZIP Code');
            return;
        }

        // Validate year
        const year = parseInt(document.getElementById('year').value);
        const currentYear = new Date().getFullYear();
        if (year < 1950 || year > currentYear) {
            alert('Please enter a valid year between 1950 and ' + currentYear);
            return;
        }

        // Validate phone number format
        const phone = document.getElementById('phone').value;
        const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
        if (!phoneRegex.test(phone)) {
            alert('Please enter a valid phone number');
            return;
        }

        // Show loading state
        form.classList.add('loading');
        const submitBtn = form.querySelector('.submit-btn');
        submitBtn.disabled = true;

        try {
            // Process images
            const files = Array.from(photoInput.files);
            const imagePromises = files.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        resolve({
                            name: file.name,
                            mimeType: file.type,
                            data: reader.result.split(',')[1]
                        });
                    };
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(file);
                });
            });

            const images = await Promise.all(imagePromises);

            // Get checked issues
            const getCheckedValues = (name) => {
                return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
                    .map(cb => cb.value);
            };

            // Prepare form data
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                preferredContact: document.getElementById('preferred-contact').value,
                make: document.getElementById('make').value,
                model: document.getElementById('model').value,
                year: document.getElementById('year').value,
                mileage: document.getElementById('mileage').value,
                vin: document.getElementById('vin').value,
                price: document.getElementById('price').value,
                condition: document.getElementById('condition').value,
                zipCode: document.getElementById('zipCode').value,
                state: document.getElementById('state').value,
                licensePlate: document.getElementById('licensePlate').value,
                liens: document.getElementById('liens').value,
                lienAmount: document.getElementById('lienAmount').value,
                title: document.getElementById('title').value,
                accidents: document.getElementById('accidents').value,
                roadTrip: document.getElementById('roadTrip').value,
                issues: getCheckedValues('issues'),
                engine_issues: getCheckedValues('engine_issues'),
                exterior_damage: getCheckedValues('exterior_damage'),
                interior_damage: getCheckedValues('interior_damage'),
                modifications: document.getElementById('modifications').value,
                smoked: document.getElementById('smoked').value,
                notes: document.getElementById('notes').value,
                images: images
            };

            // Submit directly to Google Apps Script
            console.log('Submitting form data:', formData);
            try {
                const response = await fetch('https://script.google.com/macros/s/AKfycbzLiMQQVZnhsl27qSJaDs21Pd9ITZDMiL-nOCKhdiCp2B7ezAPKnWyQVMer6eh_kXdh/exec', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    mode: 'cors',
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                console.log('Response:', result);

                if (result.status === 'success') {
                    // Show success modal
                    modal.style.display = 'flex';
                    form.reset();
                    photoPreview.innerHTML = '';
                } else {
                    throw new Error(result.message || 'Submission failed');
                }
            } catch (error) {
                alert('An error occurred: ' + error.message);
            }
        } catch (error) {
            alert('An error occurred: ' + error.message);
        } finally {
            form.classList.remove('loading');
            submitBtn.disabled = false;
        }
    });

    // Close modal functionality
    closeModalBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Format phone number as user types
    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 0) {
            if (value.length <= 3) {
                value = value;
            } else if (value.length <= 6) {
                value = value.slice(0, 3) + '-' + value.slice(3);
            } else {
                value = value.slice(0, 3) + '-' + value.slice(3, 6) + '-' + value.slice(6, 10);
            }
            e.target.value = value;
        }
    });

    // Format VIN to uppercase
    vinInput.addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });

    // Format license plate to uppercase
    licensePlateInput.addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });
}); 