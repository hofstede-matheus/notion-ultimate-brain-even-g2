@phone @settings
Feature: Changing settings later

  Once the app is set up, settings become optional: the form opens filled in, and backing out
  leaves everything as it was.

  Scenario: Reopening settings
    Given the app was set up earlier
    When I tap the settings button
    Then the phone shows "Notion Settings"
    And the token field holds the token I saved
    And the four dropdowns hold the databases I chose
    And the voice input dropdown holds the mode I saved
    And a back button is shown

  Scenario: Backing out changes nothing
    Given I reopened settings
    When I tap the back button
    Then the form closes
    And nothing about the setup has changed

  Scenario: Saving replaces the setup
    Given I reopened settings
    When I change a database and tap "Save"
    Then the new setup replaces the old one
    And it is used from then on

  Rule: Saving takes effect at once, whatever else the form is doing

    Save also writes the voice settings and re-applies the speech backend. That second part used
    to run first: on-device mode reads a 41 MB model out of storage and loads it, and the setup
    was not committed until that finished. Nothing on screen said so, and backing out of the
    apparently-stalled form threw the whole change away. Saving now commits the database and
    token choice the instant Save is tapped, before anything else — there is nothing left in that
    path for a slow or stuck voice backend to hold hostage.

    Scenario: Saving takes effect while the voice model is still loading
      Given voice input is set to on-device
      When I change a database and tap "Save"
      Then the setup is saved and in use immediately
      And the form closes at once
      And the model, the stored copy and the voice settings catch up in the background

    Scenario: A voice backend that never comes back does not block the save
      Given voice input is set to on-device
      And the stored model cannot be loaded at all
      When I change a database and tap "Save"
      Then the setup is still saved and the form still closes immediately
      # Voice input itself stays unavailable until that is fixed — a separate concern from
      # whether Save works.

  Scenario: Reopening always starts from what was saved
    Given I reopened settings and typed a different token without saving
    When I back out and reopen settings
    Then the token field holds the saved token again
    And the dropdowns hold the saved databases again
    And the voice input dropdown holds the saved mode again

  Scenario: The first-run form has no back button, this one does
    Given the app has never been set up
    Then the settings form shows no back button
    Given the app has been set up
    When I reopen settings
    Then a back button is shown

  Scenario: Switching workspaces does not reuse old lists
    Given I have browsed several views
    When I point the app at a different Notion workspace
    Then the glasses show lists from the new workspace

  Scenario: Saving settings returns to a fresh menu
    Given the glasses are showing a list
    When I save different settings
    Then the glasses show their menu
    And opening a list loads data for the new settings
