@glasses @tasks
Feature: Marking a task done

  A task can be completed from its action menu. It is confirmed first — there is no undo on the
  glasses — and it disappears from the list as soon as the change is saved.

  Only tasks can be completed. A note is never "done", so its action menu has no equivalent.

  Background:
    Given I have opened a task's action menu

  Scenario: Confirming marks the task done and returns to the list
    When I tap "Mark as done"
    Then the glasses show the header "MARK AS DONE?"
    And the choices are "Confirm: " followed by the task's name, and "Cancel"
    When I tap the first choice
    Then the glasses show "DONE"
    And "✓ " followed by the task's name
    And "Returning..."
    And the task is no longer in the list it came from
    And after 1.5 seconds that list reopens

  Scenario: The confirmation can be dismissed early
    Given I have confirmed "Mark as done"
    When I double-tap
    Then the list the task came from reopens immediately

  Scenario: Cancelling leaves the task open
    When I tap "Mark as done"
    And I tap "Cancel"
    Then the task is still in its list
    And that list reopens
