/**
 * ph-address.js
 * A helper class to generate cascading dropdowns for Philippine Addresses using the PSGC API.
 */
class PhAddressSelector {
  constructor(options) {
    this.containerId = options.containerId;
    this.targetInputId = options.targetInputId;
    this.includeBarangay = options.includeBarangay !== false;
    this.includeStreet = options.includeStreet !== false;
    this.streetPlaceholder = options.streetPlaceholder || 'Street, House No., Bldg (Optional)';
    this.container = document.getElementById(this.containerId);
    this.targetInput = document.getElementById(this.targetInputId);
    
    // UI elements
    this.streetInput = null;
    this.regionSelect = null;
    this.provinceSelect = null;
    this.citySelect = null;
    this.brgySelect = null;
    
    // To prevent infinite update loops
    this._isInternalUpdate = false;
    
    if (this.container && this.targetInput) {
        this.initUI();
    }
  }

  initUI() {
    this.container.innerHTML = '';
    
    // Create Street if enabled
    if (this.includeStreet) {
      this.streetInput = document.createElement('input');
      this.streetInput.type = 'text';
      this.streetInput.className = 'mf-input';
      this.streetInput.placeholder = this.streetPlaceholder;
      this.streetInput.style.marginBottom = '8px';
      this.streetInput.addEventListener('input', () => this.updateTarget());
      this.container.appendChild(this.streetInput);
    }

    // Create a 2x2 grid for dropdowns
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.gap = '8px';

    this.regionSelect = this.createSelect('Region');
    this.provinceSelect = this.createSelect('Province');
    this.citySelect = this.createSelect('City/Municipality');
    this.brgySelect = this.createSelect('Barangay');

    grid.appendChild(this.regionSelect);
    grid.appendChild(this.provinceSelect);
    grid.appendChild(this.citySelect);
    if (this.includeBarangay) {
      grid.appendChild(this.brgySelect);
    } else {
      this.citySelect.style.gridColumn = 'span 2';
    }

    this.container.appendChild(grid);

    this.wireEvents();
    this.loadRegions();
  }

  createSelect(placeholder) {
    const sel = document.createElement('select');
    sel.className = 'mf-input';
    sel.innerHTML = `<option value="">Select ${placeholder}</option>`;
    sel.disabled = true;
    return sel;
  }

  async fetchAPI(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('API Error');
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async loadRegions() {
    this.regionSelect.disabled = false;
    this.regionSelect.innerHTML = '<option value="">Loading Regions...</option>';
    const data = await this.fetchAPI('https://psgc.gitlab.io/api/regions/');
    data.sort((a,b) => a.name.localeCompare(b.name));
    this.populateSelect(this.regionSelect, 'Region', data);
  }

  async loadProvinces(regionCode) {
    this.provinceSelect.disabled = false;
    this.provinceSelect.innerHTML = '<option value="">Loading Provinces...</option>';
    const data = await this.fetchAPI(`https://psgc.gitlab.io/api/regions/${regionCode}/provinces/`);
    
    // NCR has no provinces
    if (data.length === 0) {
      this.provinceSelect.innerHTML = '<option value="">N/A</option>';
      this.provinceSelect.disabled = true;
      this.loadCitiesForRegion(regionCode);
    } else {
      data.sort((a,b) => a.name.localeCompare(b.name));
      this.populateSelect(this.provinceSelect, 'Province', data);
      
      this.citySelect.innerHTML = '<option value="">Select City/Municipality</option>';
      this.citySelect.disabled = true;
      if (this.includeBarangay) {
        this.brgySelect.innerHTML = '<option value="">Select Barangay</option>';
        this.brgySelect.disabled = true;
      }
    }
  }

  async loadCitiesForRegion(regionCode) {
    this.citySelect.disabled = false;
    this.citySelect.innerHTML = '<option value="">Loading Cities...</option>';
    const data = await this.fetchAPI(`https://psgc.gitlab.io/api/regions/${regionCode}/cities-municipalities/`);
    data.sort((a,b) => a.name.localeCompare(b.name));
    this.populateSelect(this.citySelect, 'City/Municipality', data);
  }

  async loadCities(provinceCode) {
    this.citySelect.disabled = false;
    this.citySelect.innerHTML = '<option value="">Loading Cities...</option>';
    const data = await this.fetchAPI(`https://psgc.gitlab.io/api/provinces/${provinceCode}/cities-municipalities/`);
    data.sort((a,b) => a.name.localeCompare(b.name));
    this.populateSelect(this.citySelect, 'City/Municipality', data);
  }

  async loadBarangays(cityCode) {
    if (!this.includeBarangay) return;
    this.brgySelect.disabled = false;
    this.brgySelect.innerHTML = '<option value="">Loading Barangays...</option>';
    const data = await this.fetchAPI(`https://psgc.gitlab.io/api/cities-municipalities/${cityCode}/barangays/`);
    data.sort((a,b) => a.name.localeCompare(b.name));
    this.populateSelect(this.brgySelect, 'Barangay', data);
  }

  populateSelect(selectEl, placeholder, data) {
    selectEl.innerHTML = `<option value="">Select ${placeholder}</option>`;
    data.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.code;
      opt.textContent = item.name;
      selectEl.appendChild(opt);
    });
  }

  wireEvents() {
    this.regionSelect.addEventListener('change', (e) => {
      this.updateTarget();
      if (!e.target.value) {
        this.provinceSelect.innerHTML = '<option value="">Select Province</option>';
        this.provinceSelect.disabled = true;
        this.citySelect.innerHTML = '<option value="">Select City/Municipality</option>';
        this.citySelect.disabled = true;
        if (this.includeBarangay) {
          this.brgySelect.innerHTML = '<option value="">Select Barangay</option>';
          this.brgySelect.disabled = true;
        }
        return;
      }
      this.loadProvinces(e.target.value);
    });

    this.provinceSelect.addEventListener('change', (e) => {
      this.updateTarget();
      if (!e.target.value) {
        this.citySelect.innerHTML = '<option value="">Select City/Municipality</option>';
        this.citySelect.disabled = true;
        if (this.includeBarangay) {
          this.brgySelect.innerHTML = '<option value="">Select Barangay</option>';
          this.brgySelect.disabled = true;
        }
        return;
      }
      this.loadCities(e.target.value);
    });

    this.citySelect.addEventListener('change', (e) => {
      this.updateTarget();
      if (!e.target.value) {
        if (this.includeBarangay) {
          this.brgySelect.innerHTML = '<option value="">Select Barangay</option>';
          this.brgySelect.disabled = true;
        }
        return;
      }
      this.loadBarangays(e.target.value);
    });

    if (this.includeBarangay) {
      this.brgySelect.addEventListener('change', () => this.updateTarget());
    }
  }

  updateTarget() {
    if (this._isInternalUpdate) return;
    const parts = [];
    if (this.includeStreet && this.streetInput && this.streetInput.value.trim()) parts.push(this.streetInput.value.trim());
    if (this.includeBarangay && this.brgySelect.selectedIndex > 0) parts.push(this.brgySelect.options[this.brgySelect.selectedIndex].text);
    if (this.citySelect.selectedIndex > 0) parts.push(this.citySelect.options[this.citySelect.selectedIndex].text);
    if (this.provinceSelect.selectedIndex > 0) {
      if (this.provinceSelect.options[this.provinceSelect.selectedIndex].text !== 'N/A') {
        parts.push(this.provinceSelect.options[this.provinceSelect.selectedIndex].text);
      }
    }
    if (this.regionSelect.selectedIndex > 0) parts.push(this.regionSelect.options[this.regionSelect.selectedIndex].text);
    
    this.targetInput.value = parts.join(', ');
  }

  // To cleanly support form edits:
  // Since reverse-engineering text into dropdown API codes is complex,
  // we just dump the existing address text into the street input,
  // and clear the dropdowns.
  setValue(val) {
    this._isInternalUpdate = true;
    if (!val) {
      if (this.includeStreet && this.streetInput) this.streetInput.value = '';
      this.regionSelect.value = '';
      this.provinceSelect.innerHTML = '<option value="">Select Province</option>';
      this.provinceSelect.disabled = true;
      this.citySelect.innerHTML = '<option value="">Select City/Municipality</option>';
      this.citySelect.disabled = true;
      if (this.includeBarangay) {
        this.brgySelect.innerHTML = '<option value="">Select Barangay</option>';
        this.brgySelect.disabled = true;
      }
    } else {
      if (this.includeStreet && this.streetInput) this.streetInput.value = val;
      this.regionSelect.value = '';
      this.provinceSelect.innerHTML = '<option value="">Select Province</option>';
      this.provinceSelect.disabled = true;
      this.citySelect.innerHTML = '<option value="">Select City/Municipality</option>';
      this.citySelect.disabled = true;
      if (this.includeBarangay) {
        this.brgySelect.innerHTML = '<option value="">Select Barangay</option>';
        this.brgySelect.disabled = true;
      }
    }
    this._isInternalUpdate = false;
  }
}
