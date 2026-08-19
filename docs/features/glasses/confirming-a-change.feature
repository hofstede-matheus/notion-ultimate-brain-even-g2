@glasses @shared
Feature: Confirming a change

  Anything that changes Notion — marking done, deleting, rescheduling, moving to a project — is
  confirmed first, then acknowledged briefly before the list comes back.

  There is no undo on the glasses. That is why every one of these is confirmed.

  What each confirmation asks, and what each acknowledgement says, is described with the action
  that asks it.

  Scenario: Every change is confirmed the same way
    When I choose an action that changes something
    Then the glasses ask a short question in the header
    And offer exactly two choices
    And the second is "Cancel"

  Scenario: Confirming makes the change and returns to the list
    Given I am confirming an action on an item
    When I tap the first choice
    Then a spinner turns in the header while the change is saved
    And the glasses then acknowledge it, ending "Returning..."
    And after 1.5 seconds the list the item came from reopens

  Scenario: The acknowledgement can be dismissed early
    Given a change has just been acknowledged
    When I double-tap
    Then the glasses return to the list immediately

  Scenario: Cancelling with the second choice
    Given I am confirming an action on an item
    When I tap "Cancel"
    Then nothing is changed
    And the list the item came from reopens

  Scenario: Cancelling by double-tapping
    Given I am confirming an action on an item
    When I double-tap
    Then nothing is changed
    And the list the item came from reopens

  Scenario: Cancelling returns to the list, not to the action menu
    Given I opened an item from a list and chose an action
    When I cancel
    Then that list reopens
    And not the item's action menu

  Scenario: A hiccup while saving is tried again before it's shown as failed
    Given I am confirming an action on an item
    And saving it fails once, for a reason that might pass
    When I tap the first choice
    Then the spinner keeps turning while it tries again on its own
    When the retry succeeds
    Then the glasses acknowledge it as normal, with no failure ever shown

  Scenario: A change that fails can be tried again
    Given I am confirming an action on an item
    And the change will not save, even after trying again on its own
    When I tap the first choice
    Then the header shows "FAILED: " followed by what went wrong
    And the two choices are unchanged
    And the item is unchanged in its list
    When I tap the first choice again
    Then the change is attempted again

  Scenario: A change that could not be sent at all says so plainly
    Given I am confirming an action on an item
    And the phone has no connection
    When I tap the first choice
    Then the header shows "FAILED: " followed by a message about the connection
    And not a raw browser error

  Scenario: Leaving after a failure
    Given a change has failed and the header shows "FAILED: "
    When I double-tap
    Then the glasses return to the list
    And nothing was changed

  Scenario: A long failure message is shortened
    Given a change fails with a message longer than one row
    Then the header still begins "FAILED: "
    And the message is shortened with a trailing "…"

  Scenario: A long item name is shortened on the confirmation
    Given I am confirming an action on an item with a very long name
    Then the name is shortened so the choice fits on one row

  Scenario: A long item name is shortened on the acknowledgement
    Given I confirmed an action on an item with a very long name
    Then the acknowledgement shows "✓ " and as much of the name as fits

  Scenario: Swiping while confirming moves between the two choices
    Given I am confirming an action
    When I swipe down
    Then the other choice is highlighted

  Scenario: An acknowledgement ignores everything but a double-tap
    Given a change has just been acknowledged
    When I tap
    Then nothing happens
    When I swipe
    Then nothing happens
    And it stays until it clears itself or I double-tap
