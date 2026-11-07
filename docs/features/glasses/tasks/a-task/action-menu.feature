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

  Scenario Outline: Backing out returns to where you came from
    Given I opened a task's contextual menu from <where>
    And I chose "<choice>"
    When I double-tap
    Then <returns>

    Examples:
      | where              | choice          | returns                                           |
      | a task list        | Open page       | the glasses show "TASK DETAILS" again             |
      | a task list        | Change project  | the glasses show "TASK DETAILS" again             |
      | a task list        | Change due date | the list the task came from reopens               |
      | a task list        | Mark as done    | the list the task came from reopens               |
      | a task list        | Delete task     | the list the task came from reopens               |
      | a project's tasks  | Open page       | the glasses show "TASK DETAILS" again             |
      | a project's tasks  | Change project  | the glasses show "TASK DETAILS" again             |
      | a project's tasks  | Change due date | that project's open tasks reopen                  |
      | a project's tasks  | Mark as done    | that project's open tasks reopen                  |
      | a project's tasks  | Delete task     | that project's open tasks reopen                  |

  Scenario: Finishing an action returns to the list
    Given I opened a task and acted on it
    When the confirmation clears
    Then the list the task came from reopens
