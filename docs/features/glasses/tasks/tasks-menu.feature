@glasses @tasks
Feature: The Tasks menu

  Five ways into the task list, plus the one place in the app that creates something new rather
  than acting on something that already exists.

  Background:
    Given I am on the root menu

  Scenario: Opening the Tasks menu
    When I tap "Tasks"
    Then the glasses show the header "TASKS"
    And the rows are:
      | Add Task (Voice) |
      | Today            |
      | Overdue          |
      | Inbox            |
      | Next 7 Days      |
      | Tomorrow         |

  Scenario Outline: Each view opens its list
    Given I am on the "TASKS" menu
    When I tap "<row>"
    Then the glasses show the header "<title>"

    Examples:
      | row         | title         |
      | Today       | TODAY'S TASKS |
      | Overdue     | OVERDUE       |
      | Inbox       | INBOX         |
      | Next 7 Days | NEXT 7 DAYS   |
      | Tomorrow    | TOMORROW      |

  Scenario: Add Task opens immediately
    Given I am on the "TASKS" menu
    When I tap "Add Task (Voice)"
    Then the glasses show the Add Task screen straight away, with nothing to wait for

  Scenario: Add Task always opens ready to record
    Given I recorded a task earlier
    When I open "Add Task (Voice)" again
    Then it is ready to record
    And nothing from the earlier attempt is still showing

  Scenario: Returning to the root menu
    Given I am on the "TASKS" menu
    When I double-tap
    Then the glasses show the header "Ultimate Brain for Even G2"
