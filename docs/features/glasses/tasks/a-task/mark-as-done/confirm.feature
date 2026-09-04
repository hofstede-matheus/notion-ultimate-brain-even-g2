@glasses @tasks
Feature: Marking a task done

  A task can be completed from its contextual menu, or in one gesture by holding its details
  screen. Either way it is confirmed first — there is no undo on the glasses — and it disappears
  from the list as soon as the change is saved.

  Only tasks can be completed. A note is never "done", so its contextual menu has no equivalent,
  and holding a note's details does nothing.

  Background:
    Given I have opened a task's contextual menu

  Scenario: Confirming marks the task done and returns to the list
    When I choose "Mark as done"
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
    When I choose "Mark as done"
    And I tap "Cancel"
    Then the task is still in its list
    And that list reopens

  Rule: Holding the task's details reaches the same confirmation directly

    Holding skips the menu rather than being a way of picking "Mark as done" from it. The glasses
    report a hold and a tap-and-hold identically, so the shortcut waits a moment to see whether a
    menu is opening, and stands down when one does — see the-five-gestures.feature.

    Scenario: Holding opens the same confirmation
      Given I have opened a task's details, instead
      When I hold
      Then the glasses show the header "MARK AS DONE?"
      And the choices are "Confirm: " followed by the task's name, and "Cancel"
      # Same screen, same choices, same round trip as from the contextual menu — only how it was
      # reached differs, and no menu ever appears on the way.

    Scenario: Tapping and holding shows the menu and marks nothing done
      Given I have opened a task's details
      When I tap and hold
      Then the contextual menu opens
      And the task is not marked done
