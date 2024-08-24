"use strict";

// Elements for DOM Manipulation
const locationList = document.querySelector(".locations__list");
const locationDescription = document.querySelector(".locations__description");
const loader = document.querySelector(".loader");
const btnMenu = document.querySelector(".menu");
const btnClose = document.querySelector(".close");
const sidebar = document.querySelector(".sidebar");

// Show sidebar menu on click
btnMenu.addEventListener("click", function () {
  sidebar.style.transform = "translateX(0)";
  btnMenu.style.display = "none";
  btnClose.style.display = "flex";
});

// Hide sidebar menu on click
btnClose.addEventListener("click", function () {
  sidebar.style.transform = "translateX(-100%)";
  btnMenu.style.display = "flex";
  btnClose.style.display = "none";
});

// Class to represent a location
class LocationCl {
  id = (Date.now() + "").slice(-10); // Generate a unique ID based on current time
  date = new Date(); // Store the date of creation

  constructor(coords, country, description, appInstance) {
    this.coords = coords;
    this.country = country;
    this.description = description;
    this.appInstance = appInstance;
    this.setDescription();
  }

  // Generate a formatted description for the location
  setDescription() {
    // prettier-ignore
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    this.dateDescription = `${this.country} on ${
      months[this.date.getMonth()]
    }, ${this.date.getDate()}`;
  }

  // Convert JSON back to LocationCl instance
  static fromJSON(json, appInstance) {
    const data = JSON.parse(json);
    const location = Object.assign(new LocationCl(), data);
    location.date = new Date(data.date); // Ensure date is restored as a Date object
    location.appInstance = appInstance;
    return location;
  }
}

// Main application class
class App {
  #map;
  #mapZoomLvl = 13;
  #locationDataStore = []; // Array to store location data
  #markers = []; // Array to store map markers

  constructor() {
    this._getCurrentLocation(); // Fetch current location on initialization
    this._getLocalStorage(); // Load saved locations from local storage
    locationList.addEventListener("click", this._handleListClick.bind(this)); // Handle click events on the location list
  }

  // Get user's current location
  _getCurrentLocation() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._renderMap.bind(this),
        function () {
          alert("Could not get current location.");
        }
      );
  }

  // Render map based on user's location
  _renderMap(position) {
    const { latitude, longitude } = position.coords;

    this.#map = L.map("map").setView([latitude, longitude], this.#mapZoomLvl);

    // Set map tile layer
    L.tileLayer("https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#map.on("click", this._getLocationData.bind(this)); // Handle map click events to fetch location data

    this.#locationDataStore.forEach((loc) => this._renderPopup(loc)); // Render popups for all saved locations
  }

  // Fetch location data when a point on the map is clicked
  async _getLocationData(mapEvent) {
    this._locationData(mapEvent.latlng);
  }

  // Get location data from an API using latitude and longitude
  async _locationData(latlng) {
    sidebar.style.transform = "translateX(0)";
    btnClose.style.display = "flex";
    btnMenu.style.display = "none";
    try {
      loader.style.display = "inline-block";
      const { lat, lng } = latlng;
      let locationData;

      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;

      const getLocation = await fetch(url);
      const location = await getLocation.json();

      if (location.error) {
        loader.style.display = "none";
        return alert("Could not get requested location");
      }

      // Create a new LocationCl object and add it to the data store
      locationData = new LocationCl(
        [lat, lng],
        location?.address?.country,
        location?.display_name
      );

      this.#locationDataStore.push(locationData);

      this._renderNewLocation(locationData); // Add the location to the list
      this._renderPopup(locationData); // Add a marker popup to the map
      this._setLocalStorage(); // Save the updated location data to local storage
    } catch (error) {
      loader.style.display = "none";
      return alert("Could NOT get requested location");
    }
  }

  // Render a new location in the sidebar list
  _renderNewLocation(locationData) {
    const html = `<li class="locations__item" data-id="${locationData.id}">
          <button class="close-icon">&times;</button>
          <h2 class="locations__title">${locationData.country}</h2>
          <p class="locations__description">
            Location details: ${locationData.description}.
          </p>
        </li>`;
    loader.style.display = "none";
    locationList.insertAdjacentHTML("afterbegin", html);
  }

  // Render a map marker with a popup for the given location
  _renderPopup(locationData) {
    const marker = L.marker(locationData.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 300,
          minWidth: 150,
          autoClose: false,
          closeOnClick: false,
        })
      )
      .setPopupContent(`${"🔰" + locationData.dateDescription}`)
      .openPopup();

    this.#markers.push({ id: locationData.id, marker }); // Store the marker for future reference
  }

  // Move the map view to the location of a clicked item in the list
  _moveToPopup(e) {
    const locationEl = e.target.closest(".locations__item");

    if (!locationEl) return;

    const location = this.#locationDataStore.find(
      (loc) => loc.id === locationEl.dataset.id
    );

    this.#map.setView(location.coords, this.#mapZoomLvl, {
      animate: true,
      pan: { duration: 1 },
    });
  }

  // Save locations to local storage
  _setLocalStorage() {
    localStorage.setItem("locations", JSON.stringify(this.#locationDataStore));
  }

  // Load locations from local storage
  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem("locations"));

    if (!data) return;

    this.#locationDataStore = data.map((loc) => {
      LocationCl.fromJSON(JSON.stringify(loc), this);
      return loc;
    });

    this.#locationDataStore.forEach((loc) => this._renderNewLocation(loc));
  }

  // Delete location data both from the UI and the data store
  _deleteLocationData(id) {
    this.#locationDataStore = this.#locationDataStore.filter(
      (loc) => loc.id !== id
    );
    const markerIndex = this.#markers.findIndex((mark) => mark.id === id);

    if (markerIndex !== -1) {
      this.#map.removeLayer(this.#markers[markerIndex].marker); // Remove marker from the map
      this.#markers.splice(markerIndex, 1); // Remove marker from the array
    }

    this._setLocalStorage(); // Update local storage after deletion
  }

  // Handle clicks on the location list (delete or move to location)
  _handleListClick(e) {
    if (e.target.classList.contains("close-icon")) {
      const locationEl = e.target.closest(".locations__item");
      this._deleteLocationData(locationEl.dataset.id);
      locationEl.remove(); // Remove the list item from the DOM
    } else this._moveToPopup(e); // Move to the location if clicked
  }
}

// Initialize the app
new App();
