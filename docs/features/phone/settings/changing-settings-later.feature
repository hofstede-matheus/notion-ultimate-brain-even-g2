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

  Scenario: Reopening always starts from what was saved
    Given I reopened settings and typed a different token without saving
    When I back out and reopen settings
    Then the token field holds the saved token again
    And the dropdowns hold the saved databases again

  Scenario: The first-run form has no back button, this one does
    Given the app has never been set up
    Then the settings form shows no back button
    Given the app has been set up
    When I reopen settings
    Then a back button is shown

  @known-gap
  Scenario: Lists from the old workspace linger after switching
    Given I have browsed several views
    When I point the app at a different Notion workspace
    Then the glasses keep showing the old workspace's lists at first
    And each one corrects itself once it checks for changes

  @known-gap
  Scenario: Changing settings does not refresh what is already on the glasses
    Given the glasses are showing a list
    When I save different settings
    Then that screen stays as it is
    And it only updates once I navigate away and back
