@phone
Feature: What's new

  A card on the status screen tells someone who already knows the app what changed in the
  version they are running. Its content is that version's CHANGELOG.md section, the same text
  as the GitHub Release, grouped the same way ("Features", "Bug Fixes", ...). Nobody writes it
  by hand.

  It stays until it is dismissed by hand. There is no timer and no auto-expiry.

  Scenario: The card appears above the connection status
    Given I have not dismissed the card for the version I am running
    When I open the app
    Then the card is shown above the connection status
    And it lists this version's changelog, under its group headings
    And a "Got it" button is shown

  Scenario: Dismissing it
    Given the card is showing
    When I tap "Got it"
    Then the card disappears
    And it does not come back the next time I open the app

  Scenario: Nothing to show
    Given I have dismissed the card for the version I am running
    When I open the app
    Then no card is shown

  Scenario: Each update shows its own notes once
    Given I dismissed the card on an earlier version
    When the app updates to a new version
    Then the card is shown with the new version's changelog
    # Dismissing stores the version, so every release shows up once with no id to change.

  Scenario: A fresh install shows the installed version's notes
    Given I have never opened the app
    When I open the app
    Then the card is shown with the installed version's changelog
