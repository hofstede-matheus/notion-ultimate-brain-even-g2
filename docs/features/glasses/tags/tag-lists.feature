@glasses @tags
Feature: The six tag lists

  Three general lists and three by tag type. All behave the same: title, count, empty message,
  and a tap opens that tag's notes.

  Scenario Outline: Each list titles itself and says what empty means
    When I open "<view>"
    And there is nothing in it
    Then the glasses show:
      """
      <title>

      <empty message>

      Double-tap to go back.
      """

    Examples:
      | view              | title          | empty message        |
      | Tags ▸ Recent     | RECENT TAGS    | No recent tags.      |
      | Tags ▸ Fav.       | FAVORITE TAGS  | No favorite tags.    |
      | Tags ▸ A-Z        | TAGS A-Z       | No tags.             |
      | Types ▸ Area      | AREA TAGS      | No area tags.        |
      | Types ▸ Resource  | RESOURCE TAGS  | No resource tags.    |
      | Types ▸ Entity    | ENTITY TAGS    | No entity tags.      |

  Scenario Outline: Each list counts its tags in the header
    Given "<view>" holds 9 tags
    When I open it
    Then the glasses show the header "<header>"

    Examples:
      | view          | header             |
      | Tags ▸ Recent | RECENT TAGS (9)    |
      | Types ▸ Area  | AREA TAGS (9)      |

  Scenario Outline: The three general lists return to the Tags menu
    Given I am viewing "<title>"
    When I double-tap
    Then the glasses show the header "TAGS"

    Examples:
      | title         |
      | RECENT TAGS   |
      | FAVORITE TAGS |
      | TAGS A-Z      |

  Scenario Outline: The three type lists return to the Types submenu
    Given I am viewing "<title>"
    When I double-tap
    Then the glasses show the header "TAG TYPES"

    Examples:
      | title         |
      | AREA TAGS     |
      | RESOURCE TAGS |
      | ENTITY TAGS   |

  Scenario: A tag is listed by name only
    Given tags with types and icons in Notion
    Then each row shows the tag's name only

  Scenario: The same tag can appear in several lists
    Given a favourite tag of type Area
    Then it appears in "FAVORITE TAGS"
    And it appears in "AREA TAGS"
    And it appears in "TAGS A-Z"

  Scenario: Tapping a tag opens its notes
    Given a tag named "Work" in any of these lists
    When I tap it
    Then the glasses show the header "TAG: Work"
