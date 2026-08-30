@phone
Feature: What's new

  A card on the status screen tells someone who already knows the app that something changed —
  right now, that tapping a task or note opens its details, that holding those details marks a
  task done, and that tap-and-hold is the new way to reach everything else.

  It stays until it is dismissed by hand. There is no timer and no auto-expiry.

  Scenario: The card appears above the connection status
    Given the app has an unseen "What's new" entry
    When I open the app
    Then the card is shown above the connection status
    And it lists what changed
    And a "Got it" button is shown

  Scenario: Dismissing it
    Given the card is showing
    When I tap "Got it"
    Then the card disappears
    And it does not come back the next time I open the app

  Scenario: Nothing to show
    Given every entry has already been dismissed
    When I open the app
    Then no card is shown

  Scenario: A future entry reappears once
    Given the current entry has been dismissed
    When a later version adds a new entry
    Then that new entry's card is shown once
    # Dismissing one entry does not dismiss entries added after it.
