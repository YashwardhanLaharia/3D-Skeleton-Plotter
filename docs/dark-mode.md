# Dark mode

Click the theme button to the left of the View panel in the 3D overview to switch between light and
dark mode. Leave focus to see the button. It changes the interface, viewport
background and grid colours.

The app uses the system colour preference until a theme has been saved. It then
remembers your choice across restarts. The theme is an app setting and is not
stored in project files. Later changes to the system theme are not picked up
automatically.

`src/theme.js` stores the choice as `skeleton-plotter-theme` in `localStorage`
and applies it through Bootstrap's `data-bs-theme` attribute. If storage is
unavailable, switching still works but the choice may not be remembered.
`App.jsx` holds the theme state and button, and
`MainView.jsx` sets the viewport colours.
