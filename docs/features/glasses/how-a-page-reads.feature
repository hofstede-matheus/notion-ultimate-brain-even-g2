@glasses @shared
Feature: What a page looks like when read

  Notion pages hold far more than the glasses can show: colours, images, attachments, tables,
  toggles, embedded databases. Reading one on the glasses means keeping the words and letting go
  of everything that only carries styling or media.

  Rule: Text is wrapped into short screenfuls

    Scenario: Long lines are wrapped
      Given a paragraph longer than one line
      When I read it
      Then it is wrapped to fit the display

    Scenario: A wrapped bullet stays attached to its marker
      Given a bullet whose text runs onto a second line
      Then the second line is indented past the bullet so the two read as one item

    Scenario: A word too long for a line is broken
      Given a line containing a URL longer than the display is wide
      Then it is broken across lines rather than running off the edge

    Scenario: A screenful never opens on a blank line
      Given a page whose next screenful would begin with a blank line
      Then that screenful starts at the first line with something on it

    Scenario: Runs of blank lines collapse
      Given a page with several blank lines in a row
      Then I see a single blank line between the surrounding text

    Scenario: Nesting is indented, up to three levels
      Given a list nested four levels deep in Notion
      Then the first three levels are indented
      And the fourth is shown at the same depth as the third
      # Any deeper and there would be no room left for the words.

  Rule: Structure that reads well is kept as written

    Scenario Outline: Ordinary formatting is left alone
      Given a page containing "<text>"
      Then I see "<text>"

      Examples:
        | text               |
        | # Heading          |
        | ## Subheading      |
        | - A bullet         |
        | 1. A numbered item |
        | - [ ] An open task |
        | - [x] A done task  |
        | > A quotation      |
        | ---                |

    Scenario: Code is shown exactly as written
      Given a page containing a block of code
      Then it is shown verbatim
      And none of the tidying below is applied to it

  Rule: Styling the glasses cannot show is dropped

    Scenario Outline: Emphasis is removed
      Given a page containing "<styled>"
      Then I see "<plain>"

      Examples:
        | styled         | plain       |
        | **emphasis**   | emphasis    |
        | *emphasis*     | emphasis    |
        | _emphasis_     | emphasis    |
        | ~~struck out~~ | struck out  |
        | `inline code`  | inline code |

    Scenario: Colour is removed
      Given a heading Notion shows in colour
      Then I see the heading text alone

    Scenario: Emoji and typographic characters are removed
      Given a line containing emoji and curly quotes
      Then they are dropped and the rest of the line reads normally

  Rule: Blocks with no plain-text form are summarised

    Scenario Outline: A block becomes a single marked line
      Given a page containing <block>
      Then I see <result>

      Examples:
        | block                           | result                            |
        | a callout                       | its text prefixed with "! "       |
        | a toggle                        | its label prefixed with "+ "      |
        | a linked child page             | its title prefixed with "[Page] " |
        | a linked database with a label  | that label prefixed with "[DB] "  |
        | a linked database with no label | "[DB]"                            |
        | content Notion could not send   | "[Link] " and a shortened address |

    Scenario: A table becomes one line per row
      Given a page containing a table
      Then each row is shown as its cells separated by " | "
      And empty cells at the end of a row are left off

    Scenario: A date mention shows the date
      Given a page mentioning the date 2026-06-23
      Then I see "2026-06-23"

    Scenario Outline: Blocks with nothing to read are left out
      Given a page containing <block>
      Then nothing about it appears

      Examples:
        | block                       |
        | an attached file            |
        | a meeting recording         |
        | a table of contents         |
        | an image                    |
        | a mention of another page   |

    Scenario: Column layouts are flattened
      Given a page laid out in columns
      Then I read the text in order, with no sign of the columns

  Rule: Links keep whatever is worth reading

    Scenario: An external link shows its label and where it goes
      Given a page containing a link labelled "our docs" pointing at "https://example.com/handbook"
      Then I see "our docs (example.com/handbook)"

    Scenario: A very long address is shortened
      Given a link with a very long address
      Then it is shortened with a trailing "…"

    Scenario: A link back into Notion shows only its label
      Given a page containing a link labelled "Projects" pointing at another Notion page
      Then I see "Projects" alone
      # The label is already the page's name — the address would say nothing more and would
      # cost a line.

    Scenario: A bare address used as its own label is not repeated
      Given a page containing a bare web address
      Then I see it once
