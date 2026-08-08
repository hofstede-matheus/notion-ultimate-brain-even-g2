@glasses @tasks
Feature: What can be done with a task

  Tapping a task anywhere in the app opens the same six choices, headed by the task's name.
  Reading comes first and deleting comes last, so a misplaced tap is unlikely to remove anything.

  Background:
    Given a task in any list

  Scenario: The action menu
    When I tap it
    Then the glasses show the task's name as the header
    And the choices are, in order:
      | Task Details    |
      | Open page       |
      | Change due date |
      | Change project  |
      | Mark as done    |
      | Delete task     |

  Scenario Outline: Each choice opens its flow
    Given I have opened a task's action menu
    When I tap "<choice>"
    Then <result>

    Examples:
      | choice          | result                             |
      | Task Details    | the glasses show "TASK DETAILS"    |
      | Open page       | the task opens in the page reader  |
      | Change due date | the due-date calendar opens        |
      | Change project  | the "MOVE TO" project picker opens |
      | Mark as done    | the glasses show "MARK AS DONE?"   |
      | Delete task     | the glasses show "DELETE?"         |

  Scenario: A long name is shortened in the header
    Given a task whose name is wider than the display
    When I open its action menu
    Then the header shows as much of the name as fits, ending with "…"
    And "Task Details" shows the name in full

  Scenario: Backing out returns to the list the task came from
    Given I opened a task from one of the task lists
    When I double-tap
    Then that list reopens

  Scenario: A task opened from inside a project returns there
    Given I opened a task from a project's tasks
    When I double-tap
    Then that project's tasks reopen

  Scenario: Finishing an action returns to the list, not to the action menu
    Given I opened a task and acted on it
    When the confirmation clears
    Then the list the task came from reopens
