@glasses @projects
Feature: The project lists

  Six lists, one per project status. Tapping a project does not act on it — it opens that
  project's own tasks and notes.

  Background:
    Given I am on the "PROJECTS" menu

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
      | row      | title             | empty message             |
      | Doing    | DOING             | No projects in progress.  |
      | Ongoing  | ONGOING           | No ongoing projects.      |
      | Planned  | PLANNED PROJECTS  | No planned projects.      |
      | On Hold  | ON HOLD           | No on-hold projects.      |
      | Done     | DONE              | No done projects.         |
      | Archived | ARCHIVED PROJECTS | No archived projects.     |

  Scenario: The full list of projects, when it is reached
    Given every project is being listed at once
    And there are none
    Then the glasses show "PROJECT BOARD" and "No projects."

  Scenario Outline: Each list counts its projects in the header
    Given "<row>" holds 4 projects
    When I open it
    Then the glasses show the header "<header>"

    Examples:
      | row      | header                 |
      | Doing    | DOING (4)              |
      | Archived | ARCHIVED PROJECTS (4)  |

  Scenario Outline: Each list returns to the Projects menu
    Given I am viewing "<title>"
    When I double-tap
    Then the glasses show the header "PROJECTS"

    Examples:
      | title             |
      | DOING             |
      | ONGOING           |
      | PLANNED PROJECTS  |
      | ON HOLD           |
      | DONE              |
      | ARCHIVED PROJECTS |

  Scenario: Tapping a project opens it rather than acting on it
    Given a project in any of these lists
    When I tap it
    Then the glasses show the project's name as the header
    And the choices are "Tasks" and "Notes"
    # A project itself cannot be changed from the glasses — only looked inside.

  Scenario: A project is listed by name only
    Given projects with statuses and deadlines in Notion
    Then each row shows the project's name only
