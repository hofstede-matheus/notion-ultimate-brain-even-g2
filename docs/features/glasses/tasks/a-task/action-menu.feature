@glasses @tasks
Feature: What can be done with a task

  Tapping a task anywhere in the app opens its details. From there, holding marks it done on the
  spot (still with a confirmation), and tapping and holding opens the OS's own contextual menu —
  a system-drawn overlay offering the five things a task can do, reading its page among them.
  Reading comes first among the menu's items and deleting comes last, so a misplaced tap there is
  unlikely to remove anything.

  Everything lives on the details screen rather than on the list because that is the only place
  the app knows which task is meant — see the-five-gestures.feature.

  Background:
    Given a task in any list

  Scenario: Tapping opens its details
    When I tap it
    Then the glasses show "TASK DETAILS"
    And its name, project and due date are shown

  Scenario: Holding its details marks it done directly
    Given I have opened a task's details
    When I hold
    Then the mark-as-done confirmation opens for it
    # No menu appears — see mark-as-done/confirm.feature for the round trip.

  Scenario: Tapping and holding its details opens the contextual menu
    Given I have opened a task's details
    When I tap and hold
    Then a menu opens over the current screen, offering:
      | Open page       |
      | Change due date |
      | Change project  |
      | Mark as done    |
      | Delete task     |
    # No "Task Details" item — that is the screen the menu was raised from.

  Scenario Outline: Each choice opens its flow
    Given I have opened a task's contextual menu
    When I choose "<choice>"
    Then <result>

    Examples:
      | choice          | result                              |
      | Open page       | the page opens in the reader        |
      | Change due date | the due-date calendar opens         |
      | Change project  | the "MOVE TO" project picker opens  |
      | Mark as done    | the glasses show "MARK AS DONE?"    |
      | Delete task     | the glasses show "DELETE?"          |

  Scenario: Leaving the reader returns to the details it was opened from
    Given I chose "Open page"
    When I double-tap
    Then the glasses show "TASK DETAILS" again

  Scenario: The menu acts on the task whose details are open
    Given more than one task in the list
    When I tap the second one and raise its contextual menu
    Then the menu's choices act on that task, not on the first in the list

  Scenario: Backing out of a chosen flow returns to the list the task came from
    Given I opened a task's contextual menu from one of the task lists
    And I chose something that opened a screen
    When I double-tap
    Then that list reopens

  Scenario: A task opened from inside a project returns there
    Given I opened a task's contextual menu from a project's tasks
    And I chose something that opened a screen
    When I double-tap
    Then that project's tasks reopen

  Scenario: Finishing an action returns to the list
    Given I opened a task and acted on it
    When the confirmation clears
    Then the list the task came from reopens
