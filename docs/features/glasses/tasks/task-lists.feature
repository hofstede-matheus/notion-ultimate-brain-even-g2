@glasses @tasks
Feature: The five task lists

  Today, Overdue, Inbox, Next 7 Days and Tomorrow. Each has its own title and its own way of
  saying "nothing here", and tapping any task opens its details.

  Background:
    Given I am on the "TASKS" menu

  Scenario Outline: Each list titles itself and says what empty means
    When I open "<row>"
    And there is nothing in it
    Then the glasses show:
      """
      <title>

      <empty message>

      Double-tap to go back.
      """

    Examples:
      | row         | title         | empty message                          |
      | Today       | TODAY'S TASKS | No tasks due today! You're all clear.   |
      | Overdue     | OVERDUE       | Nothing overdue! You're all caught up.  |
      | Inbox       | INBOX         | Your inbox is empty!                    |
      | Next 7 Days | NEXT 7 DAYS   | No tasks in the next 7 days.            |
      | Tomorrow    | TOMORROW      | No tasks due tomorrow.                  |

  Scenario Outline: What each list says while it loads
    Given I have never opened "<row>" on these glasses
    When I open it
    Then the glasses show "<waiting message>"

    Examples:
      | row         | waiting message   |
      | Today       | Fetching tasks... |
      | Overdue     | Fetching tasks... |
      | Inbox       | Fetching tasks... |
      | Next 7 Days | Fetching…         |
      | Tomorrow    | Fetching…         |

  Scenario Outline: Four of the five count their tasks
    Given "<row>" holds 5 tasks
    When I open it
    Then the glasses show the header "<header>"

    Examples:
      | row         | header          |
      | Overdue     | OVERDUE (5)     |
      | Inbox       | INBOX (5)       |
      | Next 7 Days | NEXT 7 DAYS (5) |
      | Tomorrow    | TOMORROW (5)    |

  Scenario: Today shows no count
    Given "Today" holds 5 tasks
    When I open it
    Then the glasses show the header "TODAY'S TASKS"
    And the header includes no count

  Scenario Outline: Each list returns to the Tasks menu
    Given I am viewing "<title>"
    When I double-tap
    Then the glasses show the header "TASKS"

    Examples:
      | title         |
      | TODAY'S TASKS |
      | OVERDUE       |
      | INBOX         |
      | NEXT 7 DAYS   |
      | TOMORROW      |

  Scenario: Tapping a task opens its details
    Given a task in any of these lists
    When I tap it
    Then the glasses show "TASK DETAILS" for it

  Scenario: Holding a task in the list does nothing
    Given a task in any of these lists
    When I hold it
    Then nothing happens
    # Both the hold shortcut and the contextual menu live on the details screen, since a list
    # never tells the app which row is highlighted — see the-five-gestures.feature.

  Rule: Today means today where I am

    Scenario: Dates follow the phone's timezone
      Given the phone is set to a timezone ahead of UTC
      When I open "TODAY'S TASKS"
      Then the tasks shown are the ones due on my local date

    Scenario: Travelling changes what today means
      Given I set the app up in one timezone
      When I travel to another and open "TOMORROW"
      Then it means tomorrow where I am now
      And I did not have to change any settings

  Rule: The lists are different slices of the same tasks

    Scenario: A task can be in more than one list
      Given a task due today and not filed under a project
      Then it is in "TODAY'S TASKS"
      And it is in "INBOX"
      And it is in "NEXT 7 DAYS"

    Scenario: A task with no due date is in neither Today nor Overdue
      Given a task with no due date
      Then it is not in "TODAY'S TASKS"
      And it is not in "OVERDUE"

    Scenario: Rescheduling moves a task between Today and Overdue at once
      Given "OVERDUE" shows a task due yesterday
      When I change its due date to today
      Then it is no longer in "OVERDUE"
      And it is in "TODAY'S TASKS"
      And neither list had to reload

    Scenario: Opening Overdue also brings Today up to date
      Given I have opened neither
      When I open "Overdue"
      Then it shows the tasks due before today
      When I go back and open "Today"
      Then it shows the tasks due today, with nothing to wait for
