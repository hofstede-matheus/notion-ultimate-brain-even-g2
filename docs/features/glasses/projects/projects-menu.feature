@glasses @projects
Feature: The Projects menu

  Six choices, one per project status. A project is a way in rather than a destination: what I am
  usually after is the tasks or notes filed under it.

  Background:
    Given I am on the root menu

  Scenario: Opening the Projects menu
    When I tap "Projects"
    Then the glasses show the header "PROJECTS"
    And the rows are:
      | Doing    |
      | Ongoing  |
      | Planned  |
      | On Hold  |
      | Done     |
      | Archived |

  Scenario Outline: Each row opens its list
    Given I am on the "PROJECTS" menu
    When I tap "<row>"
    Then the glasses show the header "<title>"

    Examples:
      | row      | title              |
      | Doing    | DOING              |
      | Ongoing  | ONGOING            |
      | Planned  | PLANNED PROJECTS   |
      | On Hold  | ON HOLD            |
      | Done     | DONE               |
      | Archived | ARCHIVED PROJECTS  |

  Scenario: Returning to the root menu
    Given I am on the "PROJECTS" menu
    When I double-tap
    Then the glasses show the header "Ultimate Brain"

  @known-gap
  Scenario: There is no way to see every project at once
    Given I am on the "PROJECTS" menu
    Then every choice is a single status
    And there is no choice that lists all projects together
    # The full list does exist — it is what the "MOVE TO" picker offers — but nothing in this
    # menu reaches it.
