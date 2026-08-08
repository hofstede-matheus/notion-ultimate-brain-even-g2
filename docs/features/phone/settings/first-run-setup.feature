@phone @settings
Feature: Setting the app up for the first time

  Every pair of glasses carries its own Notion token and its own four databases. Nothing is stored
  centrally, so setting the app up is the first thing that has to happen — without it there is
  nothing for the glasses to show.

  That is why the first-run form has no way out. There is no back button and no skip: the only way
  past it is a complete, working setup.

  Scenario: The first-run form cannot be dismissed
    Given the app has never been set up
    When it connects
    Then the phone shows "Notion Settings"
    And there is no back button
    And there is no settings button

  Scenario: Setting up end to end
    Given the app has never been set up
    And the form is showing
    When I paste my integration token
    And the databases finish loading
    Then four dropdowns appear, labelled:
      | Tasks Database    |
      | Notes Database    |
      | Projects Database |
      | Tags Database     |
    When I choose a database for each of the four
    And I tap "Save"
    Then the setup is remembered
    And the glasses show their menu
    And the status reads "Connected! Use your glasses."

  Scenario: The setup is reused next time
    Given I completed setup earlier
    When I reopen the app
    Then the settings form does not appear
    And the app connects straight through

  @known-gap
  Scenario: A setup that cannot be read back is treated as no setup
    Given the saved setup cannot be read back
    When I open the app
    Then the first-run form appears again
    And nothing explains that a saved setup was discarded

  @known-gap
  Scenario: A setup that fails to save does so silently
    Given the phone will not store the setup
    When I tap "Save"
    Then the app carries on and connects
    But the setup is gone the next time the app opens
    And nothing warned me
